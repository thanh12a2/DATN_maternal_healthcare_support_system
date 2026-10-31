import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppLink, navigate } from '../../../app/navigation';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { ChatbotLauncher } from '../components/chatbot/ChatbotLauncher';
import { LucideIcon } from '../../../shared/components/LucideIcon';
import { apiRequest } from '../../../services/api';
import type { ServiceContent } from '../../../types/service-content.types';
import '../../../styles/patient-service-detail.css';

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  HelpCircle,
  Info,
  Phone,
  Shield,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';

interface SpecialtyInfo {
  id: string;
  name: string;
  slug: string;
  code?: string;
}

interface ServiceTag {
  id: string;
  code: string;
  name: string;
  group?: string;
  description?: string | null;
}

interface BasePriceItem {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
}

interface DoctorRankSurchargeItem {
  id: string;
  rankCode: string;
  amountMinor: number;
  currency: string;
  status: string;
}

interface RelatedServiceItem {
  id: string;
  code: string;
  slug: string;
  name: string;
  summary?: string | null;
  kind: string;
  thumbnailUrl?: string | null;
  durationMinutes?: number | null;
  bookingEnabled: boolean;
  status: string;
  prices?: BasePriceItem[];
}

interface ServiceDetailResponse {
  id: string;
  code: string;
  slug: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  kind: 'CONSULTATION' | 'DIAGNOSTIC' | 'PROCEDURE' | 'PACKAGE' | 'VACCINATION' | 'OTHER';
  specialtyId?: string | null;
  thumbnailUrl?: string | null;
  durationMinutes?: number | null;
  bookingEnabled: boolean;
  doctorRankSelectionPolicy: 'NOT_REQUIRED' | 'BASIC_INCLUDED' | 'RANK_UPGRADE_ALLOWED';
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  content?: ServiceContent | null;
  specialty?: SpecialtyInfo | null;
  basePrice?: BasePriceItem | null;
  doctorRankSurcharges?: DoctorRankSurchargeItem[];
  relatedServices?: RelatedServiceItem[];
  tags?: ServiceTag[];
}

const KIND_LABEL_MAP: Record<string, string> = {
  CONSULTATION: 'Khám tư vấn',
  DIAGNOSTIC: 'Chẩn đoán & Xét nghiệm',
  PROCEDURE: 'Thủ thuật y khoa',
  PACKAGE: 'Gói chăm sóc trọn gói',
  VACCINATION: 'Tiêm chủng thai kỳ',
  OTHER: 'Dịch vụ khác',
};

const DOCTOR_RANK_LABELS: Record<string, string> = {
  BASIC: 'Bác sĩ Chuyên khoa',
  SPECIALIST_I: 'Bác sĩ Chuyên khoa I',
  SPECIALIST_II: 'Bác sĩ Chuyên khoa II',
  MASTER: 'Thạc sĩ Bác sĩ',
  HEAD_DOCTOR: 'Bác sĩ Trưởng khoa',
  ASSOC_PROFESSOR: 'Phó Giáo sư',
  PROFESSOR: 'Giáo sư',
  EXPERT: 'Cố vấn Chuyên gia Cao cấp',
};

const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=85';

function formatVnd(amount?: number | null): string {
  if (amount == null) return '0 đ';
  return amount.toLocaleString('vi-VN') + ' đ';
}

export function PatientServiceDetailPage({ serviceId }: { serviceId: string }) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<ServiceDetailResponse | null>(null);

  // Accordion state cho FAQs (single open)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Accordion state cho Package groups
  const [openPackageGroups, setOpenPackageGroups] = useState<Record<number, boolean>>({ 0: true });

  // Sticky nav scroll spy state
  const [activeSection, setActiveSection] = useState<string>('gioi-thieu');

  // Mobile CTA visibility: hiển thị khi Hero CTA ra khỏi viewport
  const heroCtaRef = useRef<HTMLDivElement | null>(null);
  const [showMobileStickyCta, setShowMobileStickyCta] = useState<boolean>(false);

  // Load dữ liệu dịch vụ
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    apiRequest<{ data: ServiceDetailResponse }>(`/api/catalog/services/${encodeURIComponent(serviceId)}`)
      .then((res) => {
        if (!isCancelled) {
          if (res?.data) {
            setService(res.data);
          } else {
            setError('Không tìm thấy thông tin dịch vụ');
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err?.message || 'Không thể tải dữ liệu dịch vụ');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [serviceId]);

  // Observer theo dõi nút Hero CTA để ẩn/hiện Mobile sticky CTA
  useEffect(() => {
    if (!heroCtaRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Nếu nút Hero đang nhìn thấy thì ẩn bar dưới, ngược lại thì hiện
        setShowMobileStickyCta(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(heroCtaRef.current);
    return () => observer.disconnect();
  }, [loading, service]);

  // Cập nhật Document Title và Robots Meta cho SEO
  useEffect(() => {
    if (!service) return;

    // Document title
    document.title = `${service.name} | Bệnh viện Phụ sản Tâm An`;

    // Robots meta
    const shouldNoIndex = service.status !== 'ACTIVE' || service.content?.seo?.noindex;
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (shouldNoIndex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.name = 'robots';
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.content = 'noindex, nofollow';
    } else if (robotsMeta) {
      robotsMeta.content = 'index, follow';
    }

    // JSON-LD structured data
    const scriptId = 'service-jsonld-schema';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': service.kind === 'PROCEDURE' ? 'MedicalProcedure' : 'MedicalWebPage',
      name: service.name,
      description: service.summary || service.name,
      url: window.location.href,
      provider: {
        '@type': 'Hospital',
        name: 'Bệnh viện Phụ sản Tâm An',
        telephone: '1900 6868',
      },
      offers: service.basePrice
        ? {
            '@type': 'Offer',
            price: service.basePrice.amountMinor,
            priceCurrency: service.basePrice.currency || 'VND',
            availability: service.bookingEnabled
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          }
        : undefined,
    };

    scriptTag.text = JSON.stringify(schemaData);

    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [service]);

  // Theo dõi scroll để highlight sticky navigation items
  useEffect(() => {
    const handleScroll = () => {
      const sectionIds = [
        'gioi-thieu',
        'danh-muc-goi',
        'chi-so',
        'doi-tuong',
        'quy-trinh',
        'chuan-bi',
        'bang-gia',
        'hoi-dap',
      ];
      const scrollPosition = window.scrollY + 120;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const id = sectionIds[i];
        const element = document.getElementById(id);
        if (element) {
          const top = element.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Danh sách các mục trên sticky nav (chỉ hiện mục nào có dữ liệu)
  const navItems = useMemo(() => {
    if (!service) return [];
    const content = service.content;
    const items: { id: string; label: string }[] = [];

    if (content?.intro || (content?.highlights && content.highlights.length > 0)) {
      items.push({ id: 'gioi-thieu', label: 'Giới thiệu' });
    }
    if (content?.package && content.package.included_groups?.length > 0) {
      items.push({ id: 'danh-muc-goi', label: 'Chi tiết gói' });
    }
    if (content?.parameters && content.parameters.length > 0) {
      items.push({ id: 'chi-so', label: 'Chỉ số đánh giá' });
    }
    if ((content?.suitable_for && content.suitable_for.length > 0) || (content?.not_suitable_for && content.not_suitable_for.length > 0)) {
      items.push({ id: 'doi-tuong', label: 'Phù hợp với ai' });
    }
    if (content?.process_steps && content.process_steps.length > 0) {
      items.push({ id: 'quy-trinh', label: 'Quy trình' });
    }
    if ((content?.preparation && content.preparation.length > 0) || (content?.aftercare && content.aftercare.length > 0)) {
      items.push({ id: 'chuan-bi', label: 'Chuẩn bị' });
    }
    items.push({ id: 'bang-gia', label: 'Bảng giá' });
    if (content?.faqs && content.faqs.length > 0) {
      items.push({ id: 'hoi-dap', label: 'Hỏi đáp' });
    }
    return items;
  }, [service]);

  // Loading Skeleton
  if (loading) {
    return (
      <div className="service-detail-page">
        <PublicPortalHeader />
        <div className="service-skeleton-wrapper portal-container">
          <div className="skeleton-box" style={{ height: '24px', width: '280px', marginBottom: '24px' }} />
          <div className="skeleton-box" style={{ height: '320px', width: '100%', marginBottom: '28px' }} />
          <div className="skeleton-box" style={{ height: '60px', width: '100%', marginBottom: '24px' }} />
          <div className="skeleton-box" style={{ height: '400px', width: '100%' }} />
        </div>
        <PublicPortalFooter />
      </div>
    );
  }

  // 404 / Error State
  if (error || !service) {
    return (
      <div className="service-detail-page">
        <PublicPortalHeader />
        <div className="service-detail-container">
          <div className="service-not-found-box">
            <AlertCircle size={48} color="#e06d10" style={{ margin: '0 auto 16px' }} />
            <h2>Không tìm thấy dịch vụ y tế</h2>
            <p>
              Dịch vụ y tế bạn đang tìm kiếm không tồn tại, đã ngưng cung cấp hoặc chưa được xuất bản công khai.
            </p>
            <AppLink href="/dich-vu" className="btn-book-primary">
              Xem bảng giá dịch vụ
            </AppLink>
          </div>
        </div>
        <PublicPortalFooter />
      </div>
    );
  }

  const content = service.content;
  const isBookingActive = service.bookingEnabled && service.status === 'ACTIVE';

  // Render Status Banner
  const renderBanner = () => {
    if (content?.notice && content.notice.title !== 'Lưu ý về nội dung gói') {
      const n = content.notice;
      const typeClass = `banner-${n.type.toLowerCase()}`;
      return (
        <div className={`service-status-banner ${typeClass}`} role="alert">
          <div className="banner-icon">
            {n.type === 'WARNING' || n.type === 'TEMP_SUSPENDED' ? (
              <AlertTriangle size={20} />
            ) : n.type === 'DISCONTINUED' ? (
              <AlertCircle size={20} />
            ) : (
              <Info size={20} />
            )}
          </div>
          <div className="banner-content-box">
            <div className="banner-title">{n.title}</div>
            <div className="banner-body">{n.body}</div>
          </div>
        </div>
      );
    }

    if (service.status === 'ARCHIVED') {
      return (
        <div className="service-status-banner banner-discontinued" role="alert">
          <AlertCircle size={20} className="banner-icon" />
          <div className="banner-content-box">
            <div className="banner-title">Dịch vụ đã ngừng cung cấp</div>
            <div className="banner-body">
              Hồ sơ dịch vụ này đã được lưu trữ và hiện không tiếp nhận khách hàng mới. Quý khách vui lòng tham khảo các dịch vụ tương đương.
            </div>
          </div>
        </div>
      );
    }

    if (service.status === 'INACTIVE') {
      return (
        <div className="service-status-banner banner-temp_suspended" role="alert">
          <AlertTriangle size={20} className="banner-icon" />
          <div className="banner-content-box">
            <div className="banner-title">Dịch vụ tạm ngưng tiếp nhận</div>
            <div className="banner-body">
              Hiện tại dịch vụ đang tạm dừng nhận lịch hẹn mới để bảo trì nâng cấp trang thiết bị.
            </div>
          </div>
        </div>
      );
    }

    if (!service.bookingEnabled && service.status === 'ACTIVE') {
      return (
        <div className="service-status-banner banner-warning" role="alert">
          <Info size={20} className="banner-icon" />
          <div className="banner-content-box">
            <div className="banner-title">Dịch vụ chỉ tiếp nhận qua Hotline tư vấn</div>
            <div className="banner-body">
              Dịch vụ này hiện chưa mở đăng ký trực tuyến. Vui lòng gọi trực tiếp hotline 1900 6868 để được hướng dẫn chi tiết.
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleBookingClick = () => {
    if (!isBookingActive) return;
    navigate(`/dat-lich?serviceId=${encodeURIComponent(service.id)}`);
  };

  return (
    <div className="service-detail-page">
      <PublicPortalHeader />

      <main className="service-detail-container portal-container">
        {/* 1. Breadcrumbs */}
        <nav className="service-breadcrumb" aria-label="Breadcrumb">
          <AppLink href="/">Trang chủ</AppLink>
          <span className="separator">/</span>
          <AppLink href="/dich-vu">Bảng giá dịch vụ</AppLink>
          {service.specialty && (
            <>
              <span className="separator">/</span>
              <AppLink href={`/chuyen-khoa/${service.specialty.slug}`}>
                {service.specialty.name}
              </AppLink>
            </>
          )}
          <span className="separator">/</span>
          <span className="current" aria-current="page">
            {service.name}
          </span>
        </nav>

        {/* 2. Status Banner */}
        {renderBanner()}

        {/* 3. Hero Section */}
        <section className="service-hero-card">
          <div className="hero-layout-grid">
            <div className="hero-media-wrapper">
              <img
                src={service.thumbnailUrl || FALLBACK_THUMBNAIL}
                alt={service.name}
                className="hero-thumbnail"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_THUMBNAIL;
                }}
              />
            </div>

            <div className="hero-info-column">
              <div className="hero-badge-strip">
                {service.specialty && (
                  <AppLink
                    href={`/chuyen-khoa/${service.specialty.slug}`}
                    className="badge-specialty"
                  >
                    <Stethoscope size={13} />
                    {service.specialty.name}
                  </AppLink>
                )}
                <span className="badge-kind">
                  {KIND_LABEL_MAP[service.kind] || 'Dịch vụ y tế'}
                </span>
                {service.status === 'INACTIVE' && (
                  <span className="badge-status status-inactive">Tạm ngưng</span>
                )}
                {service.status === 'ARCHIVED' && (
                  <span className="badge-status status-archived">Đã lưu trữ</span>
                )}
              </div>

              <h1 className="hero-service-title">{service.name}</h1>

              {service.summary && (
                <p className="hero-service-summary">{service.summary}</p>
              )}

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div className="hero-tags-strip">
                  {service.tags.map((tag) => (
                    <span key={tag.id || tag.code} className="hero-tag-item">
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Price */}
              <div className="hero-meta-pricing-box">
                <div className="price-unit-col">
                  <span className="price-label-text">Giá niêm yết</span>
                  <div className="price-main-value">
                    {formatVnd(service.basePrice?.amountMinor)}
                  </div>
                </div>
              </div>

              {/* Hero CTA Actions */}
              <div className="hero-cta-action-group" ref={heroCtaRef}>
                <button
                  type="button"
                  className="btn-book-primary"
                  disabled={!isBookingActive}
                  onClick={handleBookingClick}
                  title={!isBookingActive ? 'Dịch vụ hiện chưa mở đặt lịch trực tuyến' : 'Đặt lịch ngay'}
                >
                  <Sparkles size={16} />
                  Đặt lịch khám
                </button>

                <a href="tel:19006868" className="btn-consult-hotline">
                  <Phone size={15} />
                  Gọi tư vấn: 1900 6868
                </a>
              </div>

              {!isBookingActive && (
                <div className="booking-locked-hint">
                  <AlertCircle size={14} />
                  <span>Dịch vụ tạm ngưng nhận đặt lịch trực tuyến. Vui lòng gọi hotline để được hỗ trợ.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. Key Facts Bar */}
        {content?.key_facts && content.key_facts.length > 0 && (
          <div className="key-facts-wrapper">
            <div className="key-facts-grid">
              {content.key_facts.map((fact, idx) => (
                <div key={idx} className="key-fact-card">
                  <div className="key-fact-icon-wrap">
                    <LucideIcon name={fact.icon} size={20} />
                  </div>
                  <div className="key-fact-info">
                    <span className="key-fact-label">{fact.label}</span>
                    <span className="key-fact-value">{fact.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Sticky Navigation Anchor Bar */}
        {navItems.length > 0 && (
          <nav className="sticky-nav-container" aria-label="Điều hướng nhanh">
            <div className="sticky-nav-inner">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`sticky-nav-item ${activeSection === item.id ? 'active' : ''}`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* 6. Section: Giới thiệu & Điểm nổi bật */}
        {(content?.intro || (content?.highlights && content.highlights.length > 0)) && (
          <section id="gioi-thieu" className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <Sparkles size={22} color="#0f4c81" />
                Giới thiệu chi tiết dịch vụ
              </h2>
              <p className="section-heading-subtitle">
                Thông tin chuyên khoa đầy đủ chuẩn y khoa được thẩm định bởi Hội đồng chuyên môn Bệnh viện Phụ sản Tâm An.
              </p>
            </div>

            {content?.intro && (
              <div className="intro-paragraphs-block">
                {content.intro
                  .split(/\n\s*\n|\n/)
                  .map((p, i) => p.trim())
                  .filter(Boolean)
                  .map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
              </div>
            )}

            {content?.highlights && content.highlights.length > 0 && (
              <div className="highlights-cards-grid">
                {content.highlights.map((hl, idx) => (
                  <div key={idx} className="highlight-item-card">
                    <div className="highlight-icon-wrap">
                      <LucideIcon name={hl.icon} size={20} />
                    </div>
                    <div className="highlight-content-box">
                      <h4>{hl.title}</h4>
                      <p>{hl.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 7. Section: Chi tiết gói (Chỉ khi kind = PACKAGE hoặc có package) */}
        {content?.package && content.package.included_groups?.length > 0 && (
          <section id="danh-muc-goi" className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <Shield size={22} color="#0f4c81" />
                Dịch vụ gồm những gì trong gói
              </h2>
              <p className="section-heading-subtitle">
                Chi tiết danh mục quyền lợi y tế được thiết kế tối ưu, minh bạch và toàn diện cho sản phụ.
              </p>
            </div>

            <div className="package-groups-accordion">
              {content.package.included_groups.map((grp, gIdx) => {
                const isOpen = openPackageGroups[gIdx] ?? false;
                return (
                  <div key={gIdx} className="package-group-card">
                    <button
                      type="button"
                      className="package-group-header"
                      onClick={() =>
                        setOpenPackageGroups((prev) => ({
                          ...prev,
                          [gIdx]: !isOpen,
                        }))
                      }
                      aria-expanded={isOpen}
                    >
                      <span>
                        {grp.group} ({grp.items?.length || 0} quyền lợi)
                      </span>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {isOpen && (
                      <div className="package-group-items-list">
                        {grp.items?.map((item, iIdx) => (
                          <div key={iIdx} className="package-item-row">
                            <div>
                              <div className="pkg-item-name">{item.name}</div>
                              {item.note && <div className="pkg-item-note">{item.note}</div>}
                            </div>
                            {item.qty && <span className="pkg-item-qty">{item.qty}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="package-extra-grid">
              {content.package.excluded && content.package.excluded.length > 0 && (
                <div className="package-excluded-box">
                  <h4>
                    <X size={18} color="#dc2626" />
                    Không bao gồm trong gói
                  </h4>
                  <ul className="checklist-compact">
                    {content.package.excluded.map((exc, idx) => (
                      <li key={idx}>
                        <X size={15} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{exc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {content.package.conditions && content.package.conditions.length > 0 && (
                <div className="package-conditions-box">
                  <h4>
                    <Check size={18} color="#16a34a" />
                    Điều kiện áp dụng gói
                  </h4>
                  <ul className="checklist-compact">
                    {content.package.conditions.map((c, idx) => (
                      <li key={idx}>
                        <Check size={15} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {content.package.needs_confirmation && (
              <div className="package-confirm-notice">
                * Ghi chú: Danh mục quyền lợi chi tiết theo hợp đồng gói ký kết tại viện.
              </div>
            )}
          </section>
        )}

        {/* 8. Section: Chỉ số / Nội dung được đánh giá */}
        {content?.parameters && content.parameters.length > 0 && (
          <section id="chi-so" className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <CheckCircle size={22} color="#0f4c81" />
                Chỉ số y khoa được đánh giá
              </h2>
              <p className="section-heading-subtitle">
                Các thông số chuyên sâu được đo lường, phân tích trên hệ thống máy xét nghiệm và chẩn đoán tiêu chuẩn quốc tế.
              </p>
            </div>

            {/* Desktop Table */}
            <table className="parameters-desktop-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Tên chỉ số / Hạng mục</th>
                  <th style={{ width: '47%' }}>Ý nghĩa lâm sàng</th>
                  <th style={{ width: '25%' }}>Giá trị tham chiếu</th>
                </tr>
              </thead>
              <tbody>
                {content.parameters.map((param, idx) => (
                  <tr key={idx}>
                    <td className="param-name-cell">{param.name}</td>
                    <td>{param.desc}</td>
                    <td>
                      {param.reference ? (
                        <span className="param-reference-badge">{param.reference}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Theo phác đồ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List */}
            <div className="parameters-mobile-cards">
              {content.parameters.map((param, idx) => (
                <div key={idx} className="param-mobile-card">
                  <div className="param-mobile-header">{param.name}</div>
                  <div className="param-mobile-desc">{param.desc}</div>
                  {param.reference && (
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b', marginRight: '6px' }}>
                        Tham chiếu:
                      </span>
                      <span className="param-reference-badge">{param.reference}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Section: Phù hợp với ai */}
        {((content?.suitable_for && content.suitable_for.length > 0) ||
          (content?.not_suitable_for && content.not_suitable_for.length > 0)) && (
          <section id="doi-tuong" className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <Stethoscope size={22} color="#0f4c81" />
                Đối tượng phù hợp & Chống chỉ định
              </h2>
              <p className="section-heading-subtitle">
                Khuyến cáo y khoa từ bác sĩ chuyên khoa giúp quý khách lựa chọn đúng thời điểm thực hiện.
              </p>
            </div>

            <div className="suitability-columns-grid">
              {content?.suitable_for && content.suitable_for.length > 0 && (
                <div className="suitability-col col-suitable">
                  <h3 className="suitability-col-title">
                    <CheckCircle size={18} color="#16a34a" />
                    Nên thực hiện khi:
                  </h3>
                  <ul className="checklist-compact">
                    {content.suitable_for.map((item, idx) => (
                      <li key={idx}>
                        <Check size={16} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {content?.not_suitable_for && content.not_suitable_for.length > 0 && (
                <div className="suitability-col col-unsuitable">
                  <h3 className="suitability-col-title">
                    <AlertTriangle size={18} color="#d97706" />
                    Cần tư vấn trước / Chưa phù hợp khi:
                  </h3>
                  <ul className="checklist-compact">
                    {content.not_suitable_for.map((item, idx) => (
                      <li key={idx}>
                        <AlertTriangle size={16} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 10. Section: Quy trình thực hiện */}
        {content?.process_steps && content.process_steps.length > 0 && (
          <section id="quy-trinh" className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <Clock size={22} color="#0f4c81" />
                Quy trình thực hiện chuyên nghiệp
              </h2>
              <p className="section-heading-subtitle">
                Trải nghiệm thăm khám khép kín, an toàn và tinh gọn, được chuẩn hóa theo tiêu chuẩn quốc tế.
              </p>
            </div>

            <div className="process-timeline-wrapper">
              {content.process_steps.map((step, idx) => (
                <div key={idx} className="process-step-item">
                  <div className="step-marker-dot">{idx + 1}</div>
                  <div className="step-body-card">
                    <div className="step-header-row">
                      <h4 className="step-title-text">{step.title}</h4>
                    </div>
                    <p className="step-desc-text">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 11. Section: Chuẩn bị trước và Chăm sóc sau khi thực hiện */}
        {((content?.preparation && content.preparation.length > 0) ||
          (content?.aftercare && content.aftercare.length > 0)) && (
          <section id="chuan-bi" className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <Shield size={22} color="#0f4c81" />
                Hướng dẫn chuẩn bị & Lưu ý sau thực hiện
              </h2>
              <p className="section-heading-subtitle">
                Tuân thủ đúng các hướng dẫn dưới đây giúp kết quả thăm khám chuẩn xác và quá trình hồi phục an toàn nhất.
              </p>
            </div>

            <div className="prep-aftercare-grid">
              {content?.preparation && content.preparation.length > 0 && (
                <div className="prep-card-box">
                  <h3 className="prep-card-title">
                    <Clock size={18} color="#0f4c81" />
                    Trước khi đến khám:
                  </h3>
                  <ul className="checklist-compact">
                    {content.preparation.map((prep, idx) => (
                      <li key={idx}>
                        <CheckCircle size={16} color="#0f4c81" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{prep}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {content?.aftercare && content.aftercare.length > 0 && (
                <div className="prep-card-box">
                  <h3 className="prep-card-title">
                    <CheckCircle size={18} color="#16a34a" />
                    Sau khi thực hiện:
                  </h3>
                  <ul className="checklist-compact">
                    {content.aftercare.map((care, idx) => (
                      <li key={idx}>
                        <Check size={16} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{care}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 12. Section: Dấu hiệu cần đi khám ngay (Warning Signs) */}
        {content?.warning_signs && content.warning_signs.length > 0 && (
          <section className="detail-content-section" style={{ background: '#fef2f2', borderColor: '#fecdd3' }}>
            <div className="warning-signs-alert-card">
              <h3 className="warning-alert-title">
                <AlertCircle size={20} color="#e11d48" />
                Dấu hiệu cảnh báo cần đi khám hoặc cấp cứu ngay
              </h3>
              <ul className="warning-list">
                {content.warning_signs.map((sign, idx) => (
                  <li key={idx}>
                    <AlertTriangle size={16} color="#e11d48" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{sign}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* 13. Section: Công nghệ & Trang thiết bị */}
        {content?.technology && (
          <section className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <Sparkles size={22} color="#0f4c81" />
                Công nghệ & Trang thiết bị y khoa
              </h2>
            </div>

            <div className="technology-card-box">
              <h3 className="tech-title">{content.technology.title}</h3>
              <p className="tech-desc">{content.technology.desc}</p>
              {content.technology.items && content.technology.items.length > 0 && (
                <div className="tech-items-grid">
                  {content.technology.items.map((item, idx) => (
                    <span key={idx} className="tech-item-pill">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 14. Section: Độ chính xác & Giới hạn */}
        {content?.accuracy_note && (
          <section className="detail-content-section" style={{ padding: '20px' }}>
            <div className="accuracy-note-card">
              <Info size={22} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#0369a1' }}>
                  Độ chính xác và giới hạn y khoa của phương pháp:
                </strong>
                <span>{content.accuracy_note}</span>
              </div>
            </div>
          </section>
        )}

        {/* 15. Section: Bảng giá & Phụ phí chọn bác sĩ */}
        <section id="bang-gia" className="detail-content-section">
          <div className="section-header-box">
            <h2 className="section-heading-title">
              <Shield size={22} color="#0f4c81" />
              Bảng giá dịch vụ & Chính sách bác sĩ
            </h2>
            <p className="section-heading-subtitle">
              Giá niêm yết công khai theo quy định của Bệnh viện Phụ sản Tâm An, cam kết không phát sinh chi phí ẩn.
            </p>
          </div>

          <div className="pricing-content-box">
            <div className="base-price-display-banner">
              <div>
                <h4 className="base-price-title">Giá niêm yết cơ bản</h4>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Áp dụng cho mọi khách hàng đăng ký khám
                </span>
              </div>
              <div className="base-price-num">
                {formatVnd(service.basePrice?.amountMinor)}
              </div>
            </div>

            {/* Chính sách chọn bác sĩ */}
            {service.doctorRankSelectionPolicy === 'BASIC_INCLUDED' && (
              <div className="rank-policy-card">
                <strong>Chính sách bác sĩ:</strong> Đã bao gồm bác sĩ chuyên khoa phụ trách thăm khám, quý khách không phải đóng thêm phụ phí.
              </div>
            )}

            {service.doctorRankSelectionPolicy === 'RANK_UPGRADE_ALLOWED' && (
              <div>
                <h4 style={{ fontSize: '15px', color: '#183153', marginBottom: '10px', fontWeight: 700 }}>
                  Biểu phí phụ thu theo hạng bác sĩ (Tùy chọn):
                </h4>
                <div className="surcharges-table-wrapper">
                  <table className="surcharges-table">
                    <thead>
                      <tr>
                        <th>Hạng chức danh / Học vị bác sĩ</th>
                        <th>Phụ thu khám theo yêu cầu</th>
                        <th>Tổng chi phí dự kiến</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(service.doctorRankSurcharges || []).map((sc) => {
                        const baseAmt = service.basePrice?.amountMinor || 0;
                        const surchargeAmt = sc.amountMinor;
                        const totalAmt = baseAmt + surchargeAmt;
                        const rankLabel = DOCTOR_RANK_LABELS[sc.rankCode] || sc.rankCode;

                        return (
                          <tr key={sc.id || sc.rankCode}>
                            <td className="rank-name-bold">{rankLabel}</td>
                            <td className="surcharge-amount">
                              {surchargeAmt === 0 ? (
                                <span style={{ color: '#16a34a' }}>Đã bao gồm</span>
                              ) : (
                                `+${formatVnd(surchargeAmt)}`
                              )}
                            </td>
                            <td style={{ fontWeight: 600, color: '#183153' }}>
                              {formatVnd(totalAmt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 16. Section: Hỏi đáp thường gặp (FAQs) */}
        {content?.faqs && content.faqs.length > 0 && (
          <section id="hoi-dap" className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <HelpCircle size={22} color="#0f4c81" />
                Câu hỏi thường gặp
              </h2>
              <p className="section-heading-subtitle">
                Giải đáp nhanh những băn khoăn phổ biến nhất của quý khách về dịch vụ.
              </p>
            </div>

            <div className="faq-list-container">
              {content.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="faq-card-item">
                    <button
                      type="button"
                      className="faq-question-btn"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp size={18} color="#0f4c81" />
                      ) : (
                        <ChevronDown size={18} color="#64748b" />
                      )}
                    </button>
                    {isOpen && <div className="faq-answer-panel">{faq.a}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 17. Section: Dịch vụ liên quan */}
        {service.relatedServices && service.relatedServices.length > 0 && (
          <section className="detail-content-section">
            <div className="section-header-box">
              <h2 className="section-heading-title">
                <Sparkles size={22} color="#0f4c81" />
                Dịch vụ y tế liên quan
              </h2>
              <p className="section-heading-subtitle">
                Các gói khám và kỹ thuật thăm dò thường được chỉ định phối hợp cùng dịch vụ này.
              </p>
            </div>

            <div className="related-services-grid">
              {service.relatedServices.map((rel) => {
                const activeRelPrice =
                  rel.prices?.find((p) => p.status === 'ACTIVE') ?? rel.prices?.[0];

                return (
                  <AppLink
                    key={rel.id}
                    href={`/dich-vu/${rel.slug}`}
                    className="related-card"
                  >
                    <div className="related-img-wrap">
                      <img
                        src={rel.thumbnailUrl || FALLBACK_THUMBNAIL}
                        alt={rel.name}
                        className="related-img"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_THUMBNAIL;
                        }}
                      />
                    </div>
                    <div className="related-card-body">
                      <h4 className="related-card-title">{rel.name}</h4>
                      {rel.summary && (
                        <p className="related-card-summary">{rel.summary}</p>
                      )}
                      <div className="related-card-footer">
                        <span className="related-price">
                          {formatVnd(activeRelPrice?.amountMinor)}
                        </span>
                        <span className="related-btn-link">
                          Xem chi tiết <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  </AppLink>
                );
              })}
            </div>
          </section>
        )}

        {/* 18. Section: Tài liệu tham khảo & Miễn trừ trách nhiệm */}
        <section className="detail-content-section" style={{ background: '#f8fafc' }}>
          {content?.references && content.references.length > 0 && (
            <div className="references-list-box">
              <h4>Tài liệu & Hướng dẫn y khoa tham khảo:</h4>
              <ul className="ref-links-list">
                {content.references.map((ref, idx) => (
                  <li key={idx}>
                    • <strong>{ref.title}</strong> — {ref.org}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content?.disclaimer && (
            <div className="disclaimer-card-box">
              <strong>Khuyến cáo y tế:</strong> {content.disclaimer}
            </div>
          )}
        </section>
      </main>

      {/* 19. Mobile Bottom Sticky CTA */}
      <div className={`mobile-sticky-bottom-bar ${showMobileStickyCta ? 'visible' : ''}`}>
        <div className="mobile-cta-price-box">
          <span className="mobile-cta-label">Giá niêm yết</span>
          <span className="mobile-cta-val">
            {formatVnd(service.basePrice?.amountMinor)}
          </span>
        </div>
        <button
          type="button"
          className="mobile-cta-btn"
          disabled={!isBookingActive}
          onClick={handleBookingClick}
        >
          {isBookingActive ? 'Đặt lịch ngay' : 'Tạm ngưng'}
        </button>
      </div>

      <ChatbotLauncher />
      <PublicPortalFooter />
    </div>
  );
}
