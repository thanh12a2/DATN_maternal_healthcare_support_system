import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLink } from '../../../app/navigation';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { ChatbotLauncher } from '../components/chatbot/ChatbotLauncher';
import { fetchSpecialties, type SpecialtyItem } from '../../../services/specialty';
import { apiRequest } from '../../../services/api';
import '../../../styles/patient-service-catalog.css';

interface DoctorSpecialtyItem {
  id: string;
  code?: string;
  name?: string;
  isPrimary?: boolean;
}

interface DoctorProfileData {
  doctorId?: string;
  fullName?: string;
  professionalTitle?: string;
  biography?: string;
  photoUrl?: string;
}

interface DoctorData {
  id: string;
  status: string;
  consultationRank: string;
  profile?: DoctorProfileData;
  specialties?: DoctorSpecialtyItem[];
}

interface ServiceTagItem {
  id?: string;
  code: string;
  slug?: string;
  name: string;
  group?: string;
}

interface ServicePriceItem {
  id?: string;
  amountMinor: number;
  currency: string;
  status?: string;
}

interface ServiceData {
  id: string;
  code: string;
  slug: string;
  name: string;
  summary?: string;
  description?: string;
  kind?: string;
  specialtyId?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  bookingEnabled?: boolean;
  doctorRankSelectionPolicy?: string;
  status?: string;
  tags?: ServiceTagItem[];
  prices?: ServicePriceItem[];
}

function formatVnd(amountMinor?: number): string {
  if (amountMinor === undefined || amountMinor === null) return 'Liên hệ';
  return `${amountMinor.toLocaleString('vi-VN')} đ`;
}

function getServiceKindLabel(kind?: string): string {
  switch (kind) {
    case 'CONSULTATION':
      return 'Khám chuyên khoa';
    case 'DIAGNOSTIC':
      return 'Chẩn đoán hình ảnh';
    case 'PROCEDURE':
      return 'Thủ thuật y khoa';
    case 'PACKAGE':
      return 'Gói khám thai sản';
    case 'VACCINATION':
      return 'Tiêm chủng thai kỳ';
    case 'OTHER':
      return 'Dịch vụ khác';
    default:
      return 'Dịch vụ y tế';
  }
}

// Icons
function SearchIcon() {
  return (
    <svg
      className="psc-search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 18, height: 18 }}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="psc-sidebar-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="psc-sidebar-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={`psc-dropdown-chevron ${open ? 'is-open' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckmarkIcon() {
  return (
    <svg
      className="psc-dropdown-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
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

// Helper tính toán các nút trang
function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
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

export function PatientServiceCatalogPage() {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('all');
  const [selectedDoctorId, setSelectedDoctorId] = useState('all');
  const [selectedTagCode, setSelectedTagCode] = useState('all');
  const [selectedKind, setSelectedKind] = useState('all');

  // Custom Dropdown Open State
  const [specialtyDropdownOpen, setSpecialtyDropdownOpen] = useState(false);
  const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false);

  // Refs for click outside
  const specialtyDropdownRef = useRef<HTMLDivElement>(null);
  const doctorDropdownRef = useRef<HTMLDivElement>(null);
  const contentTopRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Selected Service for modal preview
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);

  // Click outside listener for custom dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        specialtyDropdownRef.current &&
        !specialtyDropdownRef.current.contains(event.target as Node)
      ) {
        setSpecialtyDropdownOpen(false);
      }
      if (
        doctorDropdownRef.current &&
        !doctorDropdownRef.current.contains(event.target as Node)
      ) {
        setDoctorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 1. Tải danh sách Chuyên khoa
  useEffect(() => {
    fetchSpecialties()
      .then((data) => setSpecialties(data))
      .catch((err) => console.error('Lỗi tải chuyên khoa:', err));
  }, []);

  // 2. Tải danh sách Bác sĩ
  useEffect(() => {
    apiRequest<{ data: DoctorData[] }>('/api/doctors')
      .then((res) => {
        setDoctors(res.data || []);
      })
      .catch((err) => console.error('Lỗi tải bác sĩ:', err));
  }, []);

  // 3. Tải danh sách Dịch vụ Y tế (Toàn bộ dữ liệu thật từ DB)
  useEffect(() => {
    setLoading(true);
    apiRequest<{ data: ServiceData[] }>('/api/catalog/services?limit=100')
      .then((res) => {
        setServices(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Lỗi tải dịch vụ:', err);
        setLoading(false);
      });
  }, []);

  // Tạo map tra cứu chuyên khoa
  const specialtyMap = useMemo(() => {
    const map = new Map<string, SpecialtyItem>();
    specialties.forEach((spec) => {
      map.set(spec.id, spec);
      if (spec.code) map.set(spec.code, spec);
    });
    return map;
  }, [specialties]);

  // Danh sách bác sĩ khả dụng tương ứng với chuyên khoa đang chọn
  const availableDoctors = useMemo(() => {
    if (selectedSpecialtyId === 'all') {
      return doctors;
    }
    return doctors.filter((doc) =>
      doc.specialties?.some((s) => s.id === selectedSpecialtyId)
    );
  }, [doctors, selectedSpecialtyId]);

  // Handler khi chọn Chuyên khoa:
  const handleSelectSpecialty = (specId: string) => {
    setSelectedSpecialtyId(specId);
    setSpecialtyDropdownOpen(false);
    if (specId !== 'all' && selectedDoctorId !== 'all') {
      const currentDoc = doctors.find((d) => d.id === selectedDoctorId);
      const belongs = currentDoc?.specialties?.some((s) => s.id === specId);
      if (!belongs) {
        setSelectedDoctorId('all');
      }
    }
  };

  // Handler khi chọn Bác sĩ:
  const handleSelectDoctor = (docId: string) => {
    setSelectedDoctorId(docId);
    setDoctorDropdownOpen(false);
    if (docId !== 'all') {
      const doc = doctors.find((d) => d.id === docId);
      const docSpec = doc?.specialties?.find((s) => s.isPrimary) || doc?.specialties?.[0];
      if (docSpec?.id) {
        setSelectedSpecialtyId(docSpec.id);
      }
    }
  };

  // Danh sách các loại hình dịch vụ có trong hệ thống và đếm số lượng
  const kindsList = useMemo(() => {
    const kindMap = new Map<string, number>();
    services.forEach((srv) => {
      if (srv.kind) {
        kindMap.set(srv.kind, (kindMap.get(srv.kind) || 0) + 1);
      }
    });

    const order = ['PACKAGE', 'CONSULTATION', 'DIAGNOSTIC', 'PROCEDURE', 'VACCINATION', 'OTHER'];
    const result: Array<{ code: string; label: string; count: number }> = [];

    order.forEach((k) => {
      if (kindMap.has(k)) {
        result.push({
          code: k,
          label: getServiceKindLabel(k),
          count: kindMap.get(k) || 0,
        });
      }
    });

    kindMap.forEach((count, k) => {
      if (!order.includes(k)) {
        result.push({
          code: k,
          label: getServiceKindLabel(k),
          count,
        });
      }
    });

    return result;
  }, [services]);

  // Danh sách tất cả các tags có trong hệ thống và đếm số lượng dịch vụ
  const tagsList = useMemo(() => {
    const tagMap = new Map<string, { code: string; name: string; count: number }>();
    services.forEach((service) => {
      (service.tags || []).forEach((t) => {
        if (!t.code) return;
        const existing = tagMap.get(t.code);
        if (existing) {
          existing.count += 1;
        } else {
          tagMap.set(t.code, { code: t.code, name: t.name || t.code, count: 1 });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  }, [services]);

  // Bộ lọc dữ liệu dịch vụ theo search, specialty, doctor, tag, kind
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      // 1. Lọc theo chuyên khoa
      if (selectedSpecialtyId !== 'all') {
        if (srv.specialtyId !== selectedSpecialtyId) return false;
      }

      // 2. Lọc theo bác sĩ
      if (selectedDoctorId !== 'all') {
        const doc = doctors.find((d) => d.id === selectedDoctorId);
        if (doc && doc.specialties && doc.specialties.length > 0) {
          const docSpecIds = doc.specialties.map((s) => s.id);
          if (!srv.specialtyId || !docSpecIds.includes(srv.specialtyId)) {
            return false;
          }
        }
      }

      // 3. Lọc theo loại hình dịch vụ (Kind)
      if (selectedKind !== 'all') {
        if (srv.kind !== selectedKind) return false;
      }

      // 4. Lọc theo thẻ dịch vụ (Tag)
      if (selectedTagCode !== 'all') {
        const hasTag = (srv.tags || []).some(
          (t) => t.code === selectedTagCode || t.slug === selectedTagCode
        );
        if (!hasTag) return false;
      }

      // 5. Lọc theo từ khóa tìm kiếm (q)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = srv.name?.toLowerCase().includes(q);
        const matchSummary = srv.summary?.toLowerCase().includes(q);
        const matchDesc = srv.description?.toLowerCase().includes(q);
        const matchCode = srv.code?.toLowerCase().includes(q);
        if (!matchName && !matchSummary && !matchDesc && !matchCode) {
          return false;
        }
      }

      return true;
    });
  }, [services, selectedSpecialtyId, selectedDoctorId, selectedKind, selectedTagCode, searchQuery, doctors]);

  // Reset page về 1 khi bất kỳ điều kiện lọc nào thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSpecialtyId, selectedDoctorId, selectedKind, selectedTagCode]);

  // Xóa tất cả bộ lọc
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedSpecialtyId('all');
    setSelectedDoctorId('all');
    setSelectedTagCode('all');
    setSelectedKind('all');
    setSpecialtyDropdownOpen(false);
    setDoctorDropdownOpen(false);
  };

  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedSpecialtyId !== 'all' ||
    selectedDoctorId !== 'all' ||
    selectedTagCode !== 'all' ||
    selectedKind !== 'all';

  // Lấy tên hiển thị chuyên khoa của dịch vụ
  const getServiceSpecialtyName = (specialtyId?: string) => {
    if (!specialtyId) return 'Sản Phụ khoa';
    return specialtyMap.get(specialtyId)?.name || 'Chuyên khoa';
  };

  // Tính toán phân trang
  const totalPages = Math.ceil(filteredServices.length / PAGE_SIZE) || 1;
  const paginatedServices = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredServices.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredServices, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (contentTopRef.current) {
      contentTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Label hiển thị trên dropdown chuyên khoa
  const selectedSpecialtyLabel = useMemo(() => {
    if (selectedSpecialtyId === 'all') {
      return `Tất cả chuyên khoa (${specialties.length})`;
    }
    const match = specialties.find((s) => s.id === selectedSpecialtyId);
    return match ? match.name : 'Chuyên khoa';
  }, [selectedSpecialtyId, specialties]);

  // Label hiển thị trên dropdown bác sĩ (hiển thị số bác sĩ khả dụng theo chuyên khoa)
  const selectedDoctorLabel = useMemo(() => {
    if (selectedDoctorId === 'all') {
      return `Tất cả bác sĩ (${availableDoctors.length})`;
    }
    const match = doctors.find((d) => d.id === selectedDoctorId);
    if (!match) return `Tất cả bác sĩ (${availableDoctors.length})`;
    const docName = match.profile?.fullName || `Bác sĩ ${match.id.slice(0, 6)}`;
    return docName;
  }, [selectedDoctorId, doctors, availableDoctors.length]);

  return (
    <div className="psc-page">
      <PublicPortalHeader />

      <main className="psc-main">
        <div className="portal-container psc-container">
          {/* 1. BREADCRUMB & TIÊU ĐỀ TRANG */}
          <nav className="psc-breadcrumb" aria-label="Breadcrumb">
            <AppLink href="/">Trang chủ</AppLink>
            <span>/</span>
            <span className="psc-breadcrumb-current">Bảng giá dịch vụ</span>
          </nav>

          <div className="psc-hero-content">
            <h1 className="psc-title">Bảng Giá Dịch Vụ & Gói Khám Chuyên Khoa</h1>
            <p className="psc-subtitle">
              Hệ thống dịch vụ y tế tiêu chuẩn quốc tế được niêm yết công khai, minh bạch.
              Hỗ trợ tư vấn phác đồ và đặt lịch trực tiếp cùng các chuyên gia Sản phụ khoa hàng đầu.
            </p>
          </div>

          {/* 2. TOP FILTER BAR: TÌM KIẾM THEO CHUYÊN KHOA & BÁC SĨ (CỐ ĐỊNH 3 CỘT, KHÔNG BỊ CO GIÃN) */}
          <div className="psc-filter-bar-card">
            <div className="psc-filter-grid">
              {/* Cột 1: Ô tìm kiếm từ khóa */}
              <div className="psc-filter-group">
                <label className="psc-filter-label" htmlFor="psc-search-input">
                  Tìm kiếm dịch vụ
                </label>
                <div className="psc-search-input-wrap">
                  <SearchIcon />
                  <input
                    id="psc-search-input"
                    type="text"
                    className="psc-search-input"
                    placeholder="Nhập tên dịch vụ, gói khám, xét nghiệm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Cột 2: Custom Dropdown lọc theo Chuyên khoa */}
              <div className="psc-filter-group" ref={specialtyDropdownRef}>
                <label className="psc-filter-label">
                  Chuyên khoa
                </label>
                <div className="psc-custom-dropdown">
                  <button
                    type="button"
                    className={`psc-dropdown-trigger ${specialtyDropdownOpen ? 'is-open' : ''}`}
                    onClick={() => {
                      setSpecialtyDropdownOpen(!specialtyDropdownOpen);
                      setDoctorDropdownOpen(false);
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
                            </div>
                            {isSelected && <CheckmarkIcon />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Cột 3: Custom Dropdown lọc theo Bác sĩ (chỉ hiển thị bác sĩ thuộc chuyên khoa đã chọn) */}
              <div className="psc-filter-group" ref={doctorDropdownRef}>
                <label className="psc-filter-label">
                  Bác sĩ phụ trách
                </label>
                <div className="psc-custom-dropdown">
                  <button
                    type="button"
                    className={`psc-dropdown-trigger ${doctorDropdownOpen ? 'is-open' : ''}`}
                    onClick={() => {
                      setDoctorDropdownOpen(!doctorDropdownOpen);
                      setSpecialtyDropdownOpen(false);
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={doctorDropdownOpen}
                  >
                    <span className="psc-dropdown-trigger-text">{selectedDoctorLabel}</span>
                    <ChevronDownIcon open={doctorDropdownOpen} />
                  </button>

                  {doctorDropdownOpen && (
                    <div className="psc-dropdown-menu" role="listbox">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedDoctorId === 'all'}
                        className={`psc-dropdown-item ${selectedDoctorId === 'all' ? 'is-selected' : ''}`}
                        onClick={() => handleSelectDoctor('all')}
                      >
                        <div className="psc-dropdown-item-label">
                          <span className="psc-dropdown-item-primary">Tất cả bác sĩ</span>
                          <span className="psc-dropdown-item-secondary">
                            {availableDoctors.length} bác sĩ {selectedSpecialtyId !== 'all' ? 'khoa này' : 'chuyên khoa'}
                          </span>
                        </div>
                        {selectedDoctorId === 'all' && <CheckmarkIcon />}
                      </button>

                      {availableDoctors.length === 0 ? (
                        <div className="psc-dropdown-empty">Chưa có bác sĩ thuộc chuyên khoa này</div>
                      ) : (
                        availableDoctors.map((doc) => {
                          const isSelected = selectedDoctorId === doc.id;
                          const docName = doc.profile?.fullName || `Bác sĩ ${doc.id.slice(0, 6)}`;
                          const docSpec = doc.specialties?.[0]?.name;
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={`psc-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => handleSelectDoctor(doc.id)}
                            >
                              <div className="psc-dropdown-item-label">
                                <span className="psc-dropdown-item-primary">{docName}</span>
                                {docSpec && (
                                  <span className="psc-dropdown-item-secondary">{docSpec}</span>
                                )}
                              </div>
                              {isSelected && <CheckmarkIcon />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hàng hiển thị các điều kiện đang lọc và nút xóa lọc (Nằm cố định ở hàng dưới, không làm co giãn 3 ô trên) */}
            {isFiltered && (
              <div className="psc-active-tags-row">
                <span className="psc-active-tags-label">Đang áp dụng:</span>
                {searchQuery && (
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
                    Khoa: {specialtyMap.get(selectedSpecialtyId)?.name}
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
                {selectedDoctorId !== 'all' && (
                  <span className="psc-active-chip">
                    BS: {doctors.find((d) => d.id === selectedDoctorId)?.profile?.fullName}
                    <button
                      type="button"
                      className="psc-active-chip-remove"
                      onClick={() => handleSelectDoctor('all')}
                      aria-label="Xóa bác sĩ"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedKind !== 'all' && (
                  <span className="psc-active-chip">
                    Loại: {getServiceKindLabel(selectedKind)}
                    <button
                      type="button"
                      className="psc-active-chip-remove"
                      onClick={() => setSelectedKind('all')}
                      aria-label="Xóa loại hình dịch vụ"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedTagCode !== 'all' && (
                  <span className="psc-active-chip">
                    Thẻ: {tagsList.find((t) => t.code === selectedTagCode)?.name}
                    <button
                      type="button"
                      className="psc-active-chip-remove"
                      onClick={() => setSelectedTagCode('all')}
                      aria-label="Xóa thẻ"
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
          </div>

          {/* 3. BỐ CỤC 2 CỘT: TRÁI LÀ LOẠI DỊCH VỤ & TAGS - PHẢI LÀ LƯỚI 3 CỘT DỊCH VỤ */}
          <div className="psc-layout">
            {/* CỘT TRÁI: KHỐI PHÂN LOẠI LOẠI DỊCH VỤ & THẺ DỊCH VỤ (TAGS) */}
            <aside className="psc-sidebar">
              {/* KHỐI 1: LOẠI DỊCH VỤ (MỚI THEO YÊU CẦU NGƯỜI DÙNG) */}
              <div className="psc-sidebar-card">
                <div className="psc-sidebar-header">
                  <LayersIcon />
                  <h3 className="psc-sidebar-title">Loại dịch vụ</h3>
                </div>

                <div className="psc-tag-list">
                  {/* Nút tất cả loại hình */}
                  <button
                    type="button"
                    className={`psc-tag-btn ${selectedKind === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedKind('all')}
                  >
                    <span className="psc-tag-btn-name">
                      <span className="psc-tag-dot"></span>
                      <span className="psc-tag-label">Tất cả loại hình</span>
                    </span>
                    <span className="psc-tag-count-badge">{services.length}</span>
                  </button>

                  {/* Danh sách từng loại hình trong hệ thống */}
                  {kindsList.map((k) => (
                    <button
                      key={k.code}
                      type="button"
                      className={`psc-tag-btn ${selectedKind === k.code ? 'active' : ''}`}
                      onClick={() => setSelectedKind(k.code)}
                    >
                      <span className="psc-tag-btn-name">
                        <span className="psc-tag-dot"></span>
                        <span className="psc-tag-label">{k.label}</span>
                      </span>
                      <span className="psc-tag-count-badge">{k.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* KHỐI 2: THẺ DỊCH VỤ (TAGS) */}
              <div className="psc-sidebar-card">
                <div className="psc-sidebar-header">
                  <TagIcon />
                  <h3 className="psc-sidebar-title">Thẻ dịch vụ (Tags)</h3>
                </div>

                <div className="psc-tag-list">
                  {/* Nút tất cả thẻ */}
                  <button
                    type="button"
                    className={`psc-tag-btn ${selectedTagCode === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedTagCode('all')}
                  >
                    <span className="psc-tag-btn-name">
                      <span className="psc-tag-dot"></span>
                      <span className="psc-tag-label">Tất cả thẻ</span>
                    </span>
                    <span className="psc-tag-count-badge">{services.length}</span>
                  </button>

                  {/* Danh sách từng thẻ */}
                  {tagsList.map((tag) => (
                    <button
                      key={tag.code}
                      type="button"
                      className={`psc-tag-btn ${selectedTagCode === tag.code ? 'active' : ''}`}
                      onClick={() => setSelectedTagCode(tag.code)}
                    >
                      <span className="psc-tag-btn-name">
                        <span className="psc-tag-dot"></span>
                        <span className="psc-tag-label">{tag.name}</span>
                      </span>
                      <span className="psc-tag-count-badge">{tag.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* KHỐI 3: Hộp hỗ trợ tư vấn & hotline */}
              <div className="psc-support-card">
                <span className="psc-support-badge">Tư vấn trực tiếp</span>
                <h4 className="psc-support-title">Cần tư vấn gói khám?</h4>
                <p className="psc-support-desc">
                  Đội ngũ chuyên viên y tế sẵn sàng hướng dẫn chọn dịch vụ phù hợp nhất với giai đoạn thai kỳ của bạn.
                </p>
                <a href="tel:19006868" className="psc-support-hotline-btn">
                  <span>📞 1900 6868</span>
                </a>
              </div>
            </aside>

            {/* CỘT PHẢI: LƯỚI 3 DỊCH VỤ MỖI HÀNG + PHÂN TRANG */}
            <section className="psc-content" ref={contentTopRef}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <p>Đang tải danh mục dịch vụ...</p>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="psc-empty-state">
                  <div className="psc-empty-icon">
                    <SearchIcon />
                  </div>
                  <h3 className="psc-empty-title">Không tìm thấy dịch vụ phù hợp</h3>
                  <p className="psc-empty-desc">
                    Không có dịch vụ nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại của bạn. Vui lòng thử lại với từ khóa khác.
                  </p>
                  <button
                    type="button"
                    className="psc-empty-reset-btn"
                    onClick={handleResetFilters}
                  >
                    Xem tất cả dịch vụ
                  </button>
                </div>
              ) : (
                <>
                  <div className="psc-services-grid">
                    {paginatedServices.map((service) => {
                      const priceVal = service.prices?.[0]?.amountMinor;
                      const specialtyName = getServiceSpecialtyName(service.specialtyId);
                      const kindLabel = getServiceKindLabel(service.kind);

                      return (
                        <article key={service.id} className="psc-service-card">
                          {/* Ảnh dịch vụ & Khung Badges bọc flex-wrap chống đè chữ */}
                          <div className="psc-card-media">
                            {service.thumbnailUrl ? (
                              <img
                                src={service.thumbnailUrl}
                                alt={service.name}
                                className="psc-card-img"
                                loading="lazy"
                              />
                            ) : (
                              <div className="psc-card-img-placeholder">
                                <CheckCircleIcon />
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Tâm An Hospital</span>
                              </div>
                            )}

                            {/* Container Badges tự động xuống dòng khi tên dài */}
                            <div className="psc-card-badges-wrap">
                              <span className="psc-card-specialty-badge">{specialtyName}</span>
                              <span className="psc-card-kind-badge">{kindLabel}</span>
                            </div>
                          </div>

                          {/* Thân card */}
                          <div className="psc-card-body">
                            <h3 className="psc-card-title" title={service.name}>
                              <AppLink href={`/dich-vu/${service.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {service.name}
                              </AppLink>
                            </h3>
                            <p className="psc-card-desc" title={service.summary || service.description}>
                              {service.summary || service.description || 'Dịch vụ khám và điều trị chuyên sâu theo chuẩn quốc tế.'}
                            </p>

                            {/* Thông tin phụ: Thời gian & trạng thái */}
                            <div className="psc-card-meta">
                              {service.durationMinutes ? (
                                <div className="psc-card-meta-item">
                                  <ClockIcon />
                                  <span>{service.durationMinutes} phút</span>
                                </div>
                              ) : null}
                              <div className="psc-card-meta-item">
                                <CheckCircleIcon />
                                <span>Đặt lịch online</span>
                              </div>
                            </div>

                            {/* Thẻ tags */}
                            {service.tags && service.tags.length > 0 && (
                              <div className="psc-card-tags">
                                {service.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className="psc-card-tag-pill">
                                    #{tag.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Giá niêm yết */}
                            <div className="psc-card-price-wrap">
                              <span className="psc-card-price-label">Giá niêm yết:</span>
                              <span className="psc-card-price-val">{formatVnd(priceVal)}</span>
                            </div>

                            {/* Nút hành động */}
                            <div className="psc-card-actions">
                              <AppLink
                                href={`/dat-lich?serviceId=${encodeURIComponent(service.id)}`}
                                className="psc-book-btn"
                              >
                                <span>Đặt lịch</span>
                              </AppLink>
                              <AppLink
                                href={`/dich-vu/${service.slug}`}
                                className="psc-detail-btn"
                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                Chi tiết
                              </AppLink>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* PHÂN TRANG (PAGINATION) */}
                  {totalPages > 1 && (
                    <nav className="psc-pagination" aria-label="Phân trang dịch vụ">
                      <button
                        type="button"
                        className="psc-page-arrow"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Trang trước"
                      >
                        <ChevronLeftIcon />
                        <span>Trước</span>
                      </button>

                      <div className="psc-page-numbers">
                        {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                          if (p === '...') {
                            return (
                              <span key={`ellipsis-${idx}`} className="psc-page-ellipsis">
                                …
                              </span>
                            );
                          }
                          const pageNum = p as number;
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              className={`psc-page-num ${currentPage === pageNum ? 'active' : ''}`}
                              onClick={() => handlePageChange(pageNum)}
                              aria-current={currentPage === pageNum ? 'page' : undefined}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        className="psc-page-arrow"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Trang sau"
                      >
                        <span>Sau</span>
                        <ChevronRightIcon />
                      </button>
                    </nav>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* 4. MODAL CHI TIẾT DỊCH VỤ (POPUP THÔNG TIN ĐẦY ĐỦ) */}
      {selectedService && (
        <div
          className="psc-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="psc-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="psc-modal-header">
              <div className="psc-modal-header-info">
                <span className="psc-card-kind-badge" style={{ position: 'static', alignSelf: 'flex-start' }}>
                  {getServiceKindLabel(selectedService.kind)} • {getServiceSpecialtyName(selectedService.specialtyId)}
                </span>
                <h3 className="psc-modal-title">{selectedService.name}</h3>
              </div>
              <button
                type="button"
                className="psc-modal-close-btn"
                onClick={() => setSelectedService(null)}
                aria-label="Đóng chi tiết"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="psc-modal-body">
              {selectedService.thumbnailUrl && (
                <div className="psc-modal-media">
                  <img src={selectedService.thumbnailUrl} alt={selectedService.name} />
                </div>
              )}

              <div className="psc-modal-info-grid">
                <div className="psc-modal-info-item">
                  <span className="psc-modal-info-label">Chuyên khoa</span>
                  <span className="psc-modal-info-val">{getServiceSpecialtyName(selectedService.specialtyId)}</span>
                </div>
                <div className="psc-modal-info-item">
                  <span className="psc-modal-info-label">Thời gian thực hiện</span>
                  <span className="psc-modal-info-val">
                    {selectedService.durationMinutes ? `${selectedService.durationMinutes} phút` : 'Theo phác đồ / Tình trạng lâm sàng'}
                  </span>
                </div>
                <div className="psc-modal-info-item">
                  <span className="psc-modal-info-label">Mã dịch vụ</span>
                  <span className="psc-modal-info-val" style={{ fontFamily: 'monospace' }}>{selectedService.code}</span>
                </div>
                <div className="psc-modal-info-item">
                  <span className="psc-modal-info-label">Hình thức tiếp nhận</span>
                  <span className="psc-modal-info-val">Khám trực tiếp tại viện</span>
                </div>
              </div>

              <div>
                <h4 className="psc-modal-section-title">Mô tả chi tiết & Quy trình chuyên môn</h4>
                <p className="psc-modal-desc-text">
                  {selectedService.description || selectedService.summary || 'Thông tin chi tiết dịch vụ đang được cập nhật.'}
                </p>
              </div>

              {selectedService.tags && selectedService.tags.length > 0 && (
                <div>
                  <h4 className="psc-modal-section-title">Đối tượng & Thẻ chỉ định</h4>
                  <div className="psc-card-tags" style={{ marginBottom: 0 }}>
                    {selectedService.tags.map((t, idx) => (
                      <span key={idx} className="psc-card-tag-pill" style={{ fontSize: 12, padding: '4px 10px' }}>
                        #{t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="psc-modal-price-box">
                <div>
                  <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Chi phí niêm yết chính thức:</div>
                  <div style={{ fontSize: 12, color: '#4ade80' }}>Đã bao gồm thuế GTGT và vật tư y tế cơ bản</div>
                </div>
                <div className="psc-modal-price-val">
                  {formatVnd(selectedService.prices?.[0]?.amountMinor)}
                </div>
              </div>
            </div>

            <div className="psc-modal-footer">
              <button
                type="button"
                className="psc-modal-btn-cancel"
                onClick={() => setSelectedService(null)}
              >
                Đóng
              </button>
              <AppLink
                href={`/dat-lich?serviceId=${encodeURIComponent(selectedService.id)}`}
                className="psc-modal-btn-book"
                onClick={() => setSelectedService(null)}
              >
                <span>Đặt lịch khám dịch vụ này</span>
                <span>→</span>
              </AppLink>
            </div>
          </div>
        </div>
      )}

      <PublicPortalFooter />
      <ChatbotLauncher />
    </div>
  );
}
