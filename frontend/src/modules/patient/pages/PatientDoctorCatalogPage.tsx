import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLink } from '../../../app/navigation';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { ChatbotLauncher } from '../components/chatbot/ChatbotLauncher';
import { fetchSpecialties, type SpecialtyItem } from '../../../services/specialty';
import { apiRequest } from '../../../services/api';
import '../../../styles/patient-service-catalog.css';
import '../../../styles/portal-landing.css';

interface DoctorProfileData {
  doctorId?: string;
  fullName?: string;
  professionalTitle?: string;
  biography?: string;
  practiceStartYear?: number;
  languages?: string[];
  photoUrl?: string;
}

interface DoctorSpecialtyData {
  id: string;
  code: string;
  name: string;
  isPrimary?: boolean;
}

interface DoctorData {
  id: string;
  status: string;
  consultationRank: string;
  roomId?: string;
  roomCode?: string;
  roomName?: string;
  profile?: DoctorProfileData;
  specialties?: DoctorSpecialtyData[];
}

interface ServiceData {
  id: string;
  code: string;
  slug: string;
  name: string;
  specialtyId?: string;
  summary?: string;
  description?: string;
  kind?: string;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        width: 15,
        height: 15,
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }} aria-hidden="true">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function GraduationCapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }} aria-hidden="true">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function HospitalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
      <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M9 10h6M12 7v6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
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

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
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

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }} aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }} aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
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

function DoctorAvatarImage({
  src,
  alt,
  className = 'portal-doc-photo',
  fallbackClassName = 'portal-doc-photo-fallback',
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={fallbackClassName}>
        <DoctorAvatarFallback />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

function getDoctorExperienceText(startYear?: number) {
  if (!startYear || typeof startYear !== 'number') return null;
  const currentYear = new Date().getFullYear();
  const years = currentYear - startYear;
  if (years <= 0) return 'Dưới 1 năm kinh nghiệm';
  return `Hơn ${years} năm kinh nghiệm (từ ${startYear})`;
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

const RANK_GROUPS: Array<{ code: string; label: string; ranks: string[] }> = [
  { code: 'all', label: 'Tất cả chức danh / học vị', ranks: [] },
  { code: 'EXPERT', label: 'Cố vấn Chuyên gia Cao cấp', ranks: ['EXPERT'] },
  { code: 'HEAD_DOCTOR', label: 'Bác sĩ Trưởng khoa', ranks: ['HEAD_DOCTOR'] },
  { code: 'PROFESSOR', label: 'Giáo sư & Phó Giáo sư', ranks: ['PROFESSOR', 'ASSOC_PROFESSOR'] },
  { code: 'SPECIALIST_II', label: 'Bác sĩ Chuyên khoa II', ranks: ['SPECIALIST_II'] },
  { code: 'MASTER', label: 'Thạc sĩ Bác sĩ', ranks: ['MASTER'] },
  { code: 'SPECIALIST_I', label: 'Bác sĩ Chuyên khoa I', ranks: ['SPECIALIST_I'] },
  { code: 'BASIC', label: 'Bác sĩ Chuyên khoa', ranks: ['BASIC'] },
];

function generatePaginationItems(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

const PAGE_SIZE = 9;

export function PatientDoctorCatalogPage() {
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('all');
  const [selectedServiceId, setSelectedServiceId] = useState('all');
  const [selectedRankCode, setSelectedRankCode] = useState('all');

  // Dropdowns state
  const [specialtyDropdownOpen, setSpecialtyDropdownOpen] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  // Refs for click outside
  const specialtyDropdownRef = useRef<HTMLDivElement>(null);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);
  const contentTopRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorData | null>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        specialtyDropdownRef.current &&
        !specialtyDropdownRef.current.contains(event.target as Node)
      ) {
        setSpecialtyDropdownOpen(false);
      }
      if (
        serviceDropdownRef.current &&
        !serviceDropdownRef.current.contains(event.target as Node)
      ) {
        setServiceDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 1. Fetch specialties from DB
  useEffect(() => {
    fetchSpecialties()
      .then((data) => setSpecialties(data))
      .catch((err) => console.error('Lỗi tải chuyên khoa:', err));
  }, []);

  // 2. Fetch doctors from DB
  useEffect(() => {
    setLoading(true);
    apiRequest<{ data: DoctorData[] }>('/api/doctors')
      .then((res) => {
        setDoctors(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Lỗi tải bác sĩ:', err);
        setLoading(false);
      });
  }, []);

  // 3. Fetch services from DB
  useEffect(() => {
    apiRequest<{ data: ServiceData[] }>('/api/catalog/services?limit=100')
      .then((res) => {
        setServices(res.data || []);
      })
      .catch((err) => console.error('Lỗi tải dịch vụ:', err));
  }, []);

  // Danh sách dịch vụ tương thích theo chuyên khoa đang chọn
  const availableServices = useMemo(() => {
    if (selectedSpecialtyId === 'all') {
      return services;
    }
    return services.filter((svc) => svc.specialtyId === selectedSpecialtyId);
  }, [services, selectedSpecialtyId]);

  // Đồng bộ hai chiều khi chọn chuyên khoa
  const handleSelectSpecialty = (specId: string) => {
    setSelectedSpecialtyId(specId);
    setSpecialtyDropdownOpen(false);
    setCurrentPage(1);

    // Nếu dịch vụ hiện tại không thuộc chuyên khoa mới thì reset về 'all'
    if (specId !== 'all' && selectedServiceId !== 'all') {
      const currentSvc = services.find((s) => s.id === selectedServiceId);
      if (currentSvc && currentSvc.specialtyId !== specId) {
        setSelectedServiceId('all');
      }
    }
  };

  // Đồng bộ hai chiều khi chọn dịch vụ
  const handleSelectService = (svcId: string) => {
    setSelectedServiceId(svcId);
    setServiceDropdownOpen(false);
    setCurrentPage(1);

    // Tự động chuyển chuyên khoa tương ứng với dịch vụ
    if (svcId !== 'all') {
      const svc = services.find((s) => s.id === svcId);
      if (svc?.specialtyId) {
        setSelectedSpecialtyId(svc.specialtyId);
      }
    }
  };

  // Tính số lượng bác sĩ theo chuyên khoa
  const doctorCountBySpecialty = useMemo(() => {
    const counts = new Map<string, number>();
    doctors.forEach((doc) => {
      (doc.specialties || []).forEach((spec) => {
        counts.set(spec.id, (counts.get(spec.id) || 0) + 1);
      });
    });
    return counts;
  }, [doctors]);

  // Tính số lượng bác sĩ theo nhóm chức danh
  const doctorCountByRankGroup = useMemo(() => {
    const counts = new Map<string, number>();
    doctors.forEach((doc) => {
      RANK_GROUPS.forEach((grp) => {
        if (grp.ranks.includes(doc.consultationRank)) {
          counts.set(grp.code, (counts.get(grp.code) || 0) + 1);
        }
      });
    });
    return counts;
  }, [doctors]);

  // Lọc dữ liệu bác sĩ
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      // 1. Lọc theo chuyên khoa
      if (selectedSpecialtyId !== 'all') {
        const hasSpec = (doc.specialties || []).some((s) => s.id === selectedSpecialtyId);
        if (!hasSpec) return false;
      }

      // 2. Lọc theo dịch vụ
      if (selectedServiceId !== 'all') {
        const svc = services.find((s) => s.id === selectedServiceId);
        if (svc?.specialtyId) {
          const hasSpec = (doc.specialties || []).some((s) => s.id === svc.specialtyId);
          if (!hasSpec) return false;
        }
      }

      // 3. Lọc theo học hàm / học vị
      if (selectedRankCode !== 'all') {
        const grp = RANK_GROUPS.find((g) => g.code === selectedRankCode);
        if (grp && !grp.ranks.includes(doc.consultationRank)) {
          return false;
        }
      }

      // 4. Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = doc.profile?.fullName?.toLowerCase().includes(q);
        const titleMatch = doc.profile?.professionalTitle?.toLowerCase().includes(q);
        const specMatch = (doc.specialties || []).some((s) => s.name.toLowerCase().includes(q));
        const bioMatch = doc.profile?.biography?.toLowerCase().includes(q);
        if (!nameMatch && !titleMatch && !specMatch && !bioMatch) {
          return false;
        }
      }

      return true;
    });
  }, [doctors, selectedSpecialtyId, selectedServiceId, selectedRankCode, searchQuery, services]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / PAGE_SIZE));
  const currentDoctors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDoctors.slice(start, start + PAGE_SIZE);
  }, [filteredDoctors, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedSpecialtyId('all');
    setSelectedServiceId('all');
    setSelectedRankCode('all');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedSpecialtyId !== 'all' ||
    selectedServiceId !== 'all' ||
    selectedRankCode !== 'all';

  const selectedSpecialtyLabel = useMemo(() => {
    if (selectedSpecialtyId === 'all') return `Tất cả chuyên khoa (${specialties.length})`;
    const spec = specialties.find((s) => s.id === selectedSpecialtyId);
    return spec ? spec.name : 'Tất cả chuyên khoa';
  }, [selectedSpecialtyId, specialties]);

  const selectedServiceLabel = useMemo(() => {
    if (selectedServiceId === 'all') return `Tất cả dịch vụ (${availableServices.length})`;
    const svc = services.find((s) => s.id === selectedServiceId);
    return svc ? svc.name : 'Tất cả dịch vụ';
  }, [selectedServiceId, availableServices, services]);

  return (
    <div className="psc-page">
      <PublicPortalHeader />

      <main className="psc-main">
        <div className="portal-container psc-container">
          {/* 1. BREADCRUMB */}
          <nav aria-label="Breadcrumb" className="psc-breadcrumb">
            <AppLink href="/">Trang chủ</AppLink>
            <span className="psc-breadcrumb-sep">/</span>
            <span className="psc-breadcrumb-current">Đội ngũ bác sĩ</span>
          </nav>

          {/* 2. HERO TIÊU ĐỀ TRANG */}
          <div className="psc-hero-content">
            <h1 className="psc-title">Đội Ngũ Bác Sĩ & Chuyên Gia Sản Phụ Khoa</h1>
            <p className="psc-subtitle">
              Hệ thống y bác sĩ chuyên môn cao, tâm huyết và giàu kinh nghiệm từ các bệnh viện phụ sản tuyến trung ương. Sẵn sàng đồng hành chăm sóc sức khỏe toàn diện và an toàn tuyệt đối cho mẹ và bé.
            </p>
          </div>

          {/* 3. BỘ LỌC 3 CỘT TRÊN CÙNG (CỐ ĐỊNH, CHUẨN ĐẸP NHƯ BẢNG GIÁ DỊCH VỤ) */}
          <section className="psc-filter-bar-card" aria-label="Bộ lọc bác sĩ">
            <div className="psc-filter-grid">
              {/* Cột 1: Tìm kiếm */}
              <div className="psc-filter-group">
                <label htmlFor="doctor-search" className="psc-filter-label">
                  Tìm kiếm bác sĩ
                </label>
                <div className="psc-search-input-wrap">
                  <span className="psc-search-icon" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <input
                    id="doctor-search"
                    type="text"
                    className="psc-search-input"
                    placeholder="Nhập tên bác sĩ, học vị, chức danh..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="psc-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Xóa từ khóa"
                    >
                      <ClearIcon />
                    </button>
                  )}
                </div>
              </div>

              {/* Cột 2: Dropdown Chuyên khoa */}
              <div className="psc-filter-group" ref={specialtyDropdownRef}>
                <label className="psc-filter-label">Chuyên khoa</label>
                <div className="psc-custom-dropdown">
                  <button
                    type="button"
                    className={`psc-dropdown-trigger ${specialtyDropdownOpen ? 'is-open' : ''}`}
                    onClick={() => {
                      setSpecialtyDropdownOpen(!specialtyDropdownOpen);
                      setServiceDropdownOpen(false);
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={specialtyDropdownOpen}
                  >
                    <span className="psc-dropdown-trigger-text">{selectedSpecialtyLabel}</span>
                    <ChevronDownIcon open={specialtyDropdownOpen} />
                  </button>

                  {specialtyDropdownOpen && (
                    <div className="psc-dropdown-menu" role="listbox">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedSpecialtyId === 'all'}
                        className={`psc-dropdown-item ${selectedSpecialtyId === 'all' ? 'is-selected' : ''}`}
                        onClick={() => handleSelectSpecialty('all')}
                      >
                        <div className="psc-dropdown-item-label">
                          <span className="psc-dropdown-item-primary">Tất cả chuyên khoa</span>
                          <span className="psc-dropdown-item-secondary">{specialties.length} chuyên khoa</span>
                        </div>
                        {selectedSpecialtyId === 'all' && <CheckmarkIcon />}
                      </button>

                      {specialties.map((spec) => {
                        const isSelected = selectedSpecialtyId === spec.id;
                        const docCount = doctorCountBySpecialty.get(spec.id) || 0;
                        return (
                          <button
                            key={spec.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`psc-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => handleSelectSpecialty(spec.id)}
                          >
                            <div className="psc-dropdown-item-label">
                              <span className="psc-dropdown-item-primary">{spec.name}</span>
                              <span className="psc-dropdown-item-secondary">{docCount} bác sĩ</span>
                            </div>
                            {isSelected && <CheckmarkIcon />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Cột 3: Dropdown Dịch vụ */}
              <div className="psc-filter-group" ref={serviceDropdownRef}>
                <label className="psc-filter-label">Dịch vụ phụ trách</label>
                <div className="psc-custom-dropdown">
                  <button
                    type="button"
                    className={`psc-dropdown-trigger ${serviceDropdownOpen ? 'is-open' : ''}`}
                    onClick={() => {
                      setServiceDropdownOpen(!serviceDropdownOpen);
                      setSpecialtyDropdownOpen(false);
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={serviceDropdownOpen}
                  >
                    <span className="psc-dropdown-trigger-text">{selectedServiceLabel}</span>
                    <ChevronDownIcon open={serviceDropdownOpen} />
                  </button>

                  {serviceDropdownOpen && (
                    <div className="psc-dropdown-menu" role="listbox">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedServiceId === 'all'}
                        className={`psc-dropdown-item ${selectedServiceId === 'all' ? 'is-selected' : ''}`}
                        onClick={() => handleSelectService('all')}
                      >
                        <div className="psc-dropdown-item-label">
                          <span className="psc-dropdown-item-primary">Tất cả dịch vụ</span>
                          <span className="psc-dropdown-item-secondary">
                            {availableServices.length} dịch vụ {selectedSpecialtyId !== 'all' ? 'chuyên khoa này' : ''}
                          </span>
                        </div>
                        {selectedServiceId === 'all' && <CheckmarkIcon />}
                      </button>

                      {availableServices.map((svc) => {
                        const isSelected = selectedServiceId === svc.id;
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`psc-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => handleSelectService(svc.id)}
                          >
                            <div className="psc-dropdown-item-label">
                              <span className="psc-dropdown-item-primary">{svc.name}</span>
                            </div>
                            {isSelected && <CheckmarkIcon />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Thanh hiển thị các tiêu chí lọc đang chọn (Active Filter Chips) */}
            {hasActiveFilters && (
              <div className="psc-active-tags-row">
                <span className="psc-active-tags-label">Đang áp dụng:</span>

                {searchQuery.trim() && (
                  <span className="psc-active-chip">
                    Từ khóa: &quot;{searchQuery}&quot;
                    <button
                      type="button"
                      className="psc-active-chip-remove"
                      onClick={() => setSearchQuery('')}
                      aria-label="Xóa từ khóa"
                    >
                      ×
                    </button>
                  </span>
                )}

                {selectedSpecialtyId !== 'all' && (
                  <span className="psc-active-chip">
                    Khoa: {specialties.find((s) => s.id === selectedSpecialtyId)?.name}
                    <button
                      type="button"
                      className="psc-active-chip-remove"
                      onClick={() => handleSelectSpecialty('all')}
                      aria-label="Xóa chuyên khoa"
                    >
                      ×
                    </button>
                  </span>
                )}

                {selectedServiceId !== 'all' && (
                  <span className="psc-active-chip">
                    Dịch vụ: {services.find((s) => s.id === selectedServiceId)?.name}
                    <button
                      type="button"
                      className="psc-active-chip-remove"
                      onClick={() => setSelectedServiceId('all')}
                      aria-label="Xóa dịch vụ"
                    >
                      ×
                    </button>
                  </span>
                )}

                {selectedRankCode !== 'all' && (
                  <span className="psc-active-chip">
                    Học vị: {RANK_GROUPS.find((g) => g.code === selectedRankCode)?.label}
                    <button
                      type="button"
                      className="psc-active-chip-remove"
                      onClick={() => setSelectedRankCode('all')}
                      aria-label="Xóa học vị"
                    >
                      ×
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  className="psc-clear-all-filters-btn"
                  onClick={handleResetFilters}
                >
                  <CloseIcon />
                  <span>Xóa tất cả bộ lọc</span>
                </button>
              </div>
            )}
          </section>

          {/* 4. KHU VỰC THÂN TRANG: LƯỚI 3 BÁC SĨ TRÊN 1 HÀNG NGANG */}
          <div className="psc-doctor-catalog-body" ref={contentTopRef} style={{ marginTop: 24 }}>
            {loading ? (
              <div className="portal-doc-loading-card">
                <div className="portal-doc-loading-spinner" />
                <p>Đang tải danh sách bác sĩ chuyên khoa từ hệ thống...</p>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="psc-empty-state">
                <div className="psc-empty-icon">
                  <StethoscopeIcon />
                </div>
                <h4 className="psc-empty-title">Không tìm thấy bác sĩ phù hợp</h4>
                <p className="psc-empty-desc">
                  Không có bác sĩ nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại của bạn. Vui lòng thử lại với chuyên khoa hoặc từ khóa khác.
                </p>
                <button
                  type="button"
                  className="psc-empty-reset-btn"
                  onClick={handleResetFilters}
                >
                  Xem tất cả bác sĩ
                </button>
              </div>
            ) : (
              <>
                <div className="portal-doctors-three-col-grid">
                  {currentDoctors.map((doc) => {
                    const profile = doc.profile;
                    const docName = profile?.fullName || 'Bác sĩ chuyên khoa';
                    const docTitle = profile?.professionalTitle || 'Bác sĩ Sản Phụ khoa';
                    const docPhoto = profile?.photoUrl;
                    const docExp = getDoctorExperienceText(profile?.practiceStartYear);

                    // Tìm chuyên khoa chính để đặt link đặt lịch
                    const primarySpec = (doc.specialties || []).find((s) => s.isPrimary) || doc.specialties?.[0];
                    const primarySpecId = primarySpec?.id || '';

                    return (
                      <div key={doc.id} className="portal-doc-card">
                        <div className="portal-doc-card-body">
                          {/* Cột trái: Ảnh chân dung */}
                          <div className="portal-doc-avatar-box">
                            <div
                              className="portal-doc-avatar-wrap"
                              onClick={() => setSelectedDoctor(doc)}
                              title="Bấm để xem hồ sơ chi tiết"
                            >
                              <DoctorAvatarImage src={docPhoto} alt={docName} />
                            </div>
                          </div>

                          {/* Cột phải: Thông tin bác sĩ */}
                          <div className="portal-doc-meta-box">
                            {/* 1. Tên bác sĩ */}
                            <h3
                              className="portal-doc-name"
                              onClick={() => setSelectedDoctor(doc)}
                              title="Bấm để xem hồ sơ bác sĩ"
                            >
                              {docName}
                            </h3>

                            {/* 2. Danh sách thẻ chuyên khoa (chuyên khoa lên TRƯỚC học vấn, primary hiển thị xanh) */}
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

                            {/* 3. Học hàm / chức danh (bên dưới chuyên khoa) */}
                            <div className="portal-doc-title">
                              <GraduationCapIcon />
                              <span>{docTitle}</span>
                            </div>

                            {/* 4. Chi tiết kinh nghiệm & bệnh viện (chữ thường, không in đậm, không màu xanh) */}
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

                        {/* Chân card: 2 nút Xem hồ sơ & Đặt lịch khám */}
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
                            href={`/dat-lich?doctorId=${encodeURIComponent(doc.id)}&specialtyId=${encodeURIComponent(primarySpecId)}`}
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

                {/* 5. PHÂN TRANG (PAGINATION) 9 BÁC SĨ / TRANG */}
                {totalPages > 1 && (
                  <nav className="psc-pagination" aria-label="Phân trang bác sĩ">
                    <button
                      type="button"
                      className="psc-page-arrow"
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                      aria-label="Trang trước"
                    >
                      <ChevronLeftIcon />
                      <span>Trước</span>
                    </button>

                    <div className="psc-page-numbers">
                      {generatePaginationItems(currentPage, totalPages).map((item, idx) => {
                        if (item === '...') {
                          return (
                            <span key={`dots-${idx}`} className="psc-page-ellipsis">
                              …
                            </span>
                          );
                        }
                        const pageNum = Number(item);
                        const isActive = pageNum === currentPage;
                        return (
                          <button
                            key={`page-${pageNum}`}
                            type="button"
                            className={`psc-page-num ${isActive ? 'active' : ''}`}
                            onClick={() => handlePageChange(pageNum)}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="psc-page-arrow"
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                      aria-label="Trang sau"
                    >
                      <span>Sau</span>
                      <ChevronRightIcon />
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* 6. MODAL CHI TIẾT HỒ SƠ BÁC SĨ (100% DỮ LIỆU THỰC TỪ DATABASE) */}
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
                  <DoctorAvatarImage
                    src={selectedDoctor.profile?.photoUrl}
                    alt={selectedDoctor.profile?.fullName || 'Bác sĩ'}
                    className="portal-doc-modal-avatar"
                    fallbackClassName="portal-doc-modal-avatar-fallback"
                  />
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

              {/* Lưới 3 thông số chuyên môn */}
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
                        : 'Sản phụ khoa'}
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
                href={`/dat-lich?doctorId=${encodeURIComponent(selectedDoctor.id)}&specialtyId=${encodeURIComponent(selectedDoctor.specialties?.find((s) => s.isPrimary)?.id || selectedDoctor.specialties?.[0]?.id || '')}`}
                className="portal-doc-modal-book-btn"
              >
                <CalendarIcon />
                <span>Đặt lịch khám với bác sĩ</span>
              </AppLink>
            </div>
          </div>
        </div>
      )}

      {/* Floating Mascot Chatbot Launcher */}
      <ChatbotLauncher />

      {/* Public Portal Footer */}
      <PublicPortalFooter />
    </div>
  );
}

