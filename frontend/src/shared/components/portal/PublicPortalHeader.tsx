import { useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../../app/navigation';
import { UserChip } from '../navigation/UserChip';
import { fetchSpecialties, type SpecialtyItem } from '../../../services/specialty';

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: 16, height: 16 }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`portal-dropdown-chevron ${open ? 'is-open' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 13, height: 13 }}
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function PublicPortalHeader() {
  const auth = useAuthSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSpecialtyOpen, setIsSpecialtyOpen] = useState(false);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(true);

  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const isAuthenticated = auth.status === 'authenticated' && Boolean(auth.user);
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isHomePage = currentPath === '/';
  const isServicesPage = currentPath.startsWith('/dich-vu');
  const isDoctorsPage = currentPath.startsWith('/bac-si');
  const isSpecialtyPage = currentPath.startsWith('/chuyen-khoa');
  const isPregnancyGuidePage = currentPath.startsWith('/cam-nang-thai-ky');

  // Fetch specialties on mount to ensure immediate responsiveness
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    let active = true;
    fetchSpecialties()
      .then((data) => {
        if (active) {
          setSpecialties(data);
          setLoadingSpecialties(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadingSpecialties(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isSpecialtyOpen) return;
    function handleClickOutside(e: PointerEvent) {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsSpecialtyOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isSpecialtyOpen]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function handleNavigateHome(e: React.MouseEvent) {
    e.preventDefault();
    setMobileMenuOpen(false);
    setIsSpecialtyOpen(false);
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleMouseEnter() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsSpecialtyOpen(true);
  }

  function handleMouseLeave() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsSpecialtyOpen(false);
    }, 180);
  }

  function handleToggleSpecialty(e: React.MouseEvent) {
    e.preventDefault();
    setIsSpecialtyOpen((prev) => !prev);
  }

  function handleCloseDropdown() {
    setIsSpecialtyOpen(false);
    setMobileMenuOpen(false);
  }

  return (
    <header className="public-portal-header">
      {/* 1. Tầng trên: Logo bên trái - Nút Đăng nhập/Đăng ký hoặc Chip người dùng bên phải */}
      <div className="portal-header-top">
        <div className="portal-container portal-header-top-inner">
          {/* Logo & Slogan Tâm An */}
          <AppLink
            href="/"
            className="portal-brand"
            aria-label="Bệnh viện Phụ sản Tâm An — Về trang chủ"
            onClick={handleNavigateHome}
          >
            <img
              src="/brand/logo-symbol-clean.png"
              alt="Bệnh viện Phụ sản Tâm An"
              className="portal-brand-symbol"
            />
            <div className="portal-brand-typography">
              <div className="portal-brand-heading">
                <span className="brand-name-main">TÂM AN</span>
                <span className="brand-badge-sub">HOSPITAL</span>
              </div>
              <span className="portal-brand-slogan-text">
                Trọn vẹn yêu thương, vẹn toàn <strong className="slogan-accent">yên tâm</strong>
              </span>
            </div>
          </AppLink>

          {/* Cụm Action bên phải: Chưa đăng nhập -> Đăng nhập / Đăng ký; Đã đăng nhập -> UserChip */}
          <div className="portal-header-top-actions">
            {!isAuthenticated ? (
              <div className="portal-auth-group">
                <AppLink href="/dang-nhap" className="portal-top-btn-login">
                  Đăng nhập
                </AppLink>
                <AppLink href="/dang-ky" className="portal-top-btn-register">
                  Đăng ký
                </AppLink>
                <AppLink href="/dang-nhap?returnUrl=/dat-lich" className="portal-top-btn-booking hide-on-mobile">
                  <CalendarIcon />
                  <span>Đặt lịch khám</span>
                </AppLink>
              </div>
            ) : (
              <div className="portal-authenticated-group">
                <AppLink href="/dat-lich" className="portal-top-btn-booking hide-on-mobile">
                  <CalendarIcon />
                  <span>Đặt lịch khám</span>
                </AppLink>
                <UserChip />
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="portal-mobile-toggle"
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="portal-hamburger-line" />
              <span className="portal-hamburger-line" />
              <span className="portal-hamburger-line" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tầng dưới: Thanh điều hướng với Dropdown Chuyên khoa */}
      <div className={`portal-header-nav ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="portal-container portal-nav-container">
          <nav className="portal-nav-bar" aria-label="Thanh điều hướng chính">
            <AppLink
              href="/"
              className={`portal-nav-item ${isHomePage ? 'active' : ''}`}
              onClick={handleNavigateHome}
            >
              Trang chủ
            </AppLink>

            {/* Mục Chuyên khoa với Dropdown 2 cột */}
            <div
              className={`portal-nav-dropdown-wrapper ${isSpecialtyOpen ? 'is-open' : ''}`}
              ref={dropdownContainerRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`portal-nav-item-dropdown-btn ${isSpecialtyOpen || isSpecialtyPage ? 'is-active' : ''}`}
                onClick={handleToggleSpecialty}
                aria-haspopup="true"
                aria-expanded={isSpecialtyOpen}
              >
                <span>Chuyên khoa</span>
                <ChevronDownIcon open={isSpecialtyOpen} />
              </button>

              {/* Panel Dropdown nổi */}
              {isSpecialtyOpen && (
                <div
                  className="portal-specialties-dropdown"
                  role="menu"
                  aria-label="Danh sách chuyên khoa"
                >
                  {/* Danh sách 2 cột cân đối lấy trực tiếp từ database */}
                  <div className="portal-specialties-body">
                    {loadingSpecialties ? (
                      <div className="portal-specialties-grid portal-specialties-loading">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <div key={idx} className="portal-specialty-skeleton-item">
                            <div className="portal-specialty-skeleton-bar" />
                          </div>
                        ))}
                      </div>
                    ) : specialties.length > 0 ? (
                      <div className="portal-specialties-grid">
                        {specialties.map((item) => (
                          <AppLink
                            key={item.id || item.slug}
                            href={`/chuyen-khoa/${item.slug}`}
                            className="portal-specialty-item"
                            role="menuitem"
                            onClick={handleCloseDropdown}
                          >
                            <span className="portal-specialty-name">{item.name}</span>
                            <span className="portal-specialty-arrow" aria-hidden="true">
                              <ArrowRightIcon />
                            </span>
                          </AppLink>
                        ))}
                      </div>
                    ) : (
                      <div className="portal-specialties-empty">
                        <p>Đang cập nhật danh mục chuyên khoa.</p>
                      </div>
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="portal-specialties-dropdown-footer">
                    <AppLink
                      href="/dich-vu"
                      className="portal-dropdown-footer-link"
                      onClick={handleCloseDropdown}
                    >
                      <span>Xem tất cả danh mục dịch vụ & bảng giá</span>
                      <ArrowRightIcon />
                    </AppLink>
                  </div>
                </div>
              )}
            </div>

            <AppLink
              href="/bac-si"
              className={`portal-nav-item ${isDoctorsPage ? 'active' : ''}`}
              onClick={handleCloseDropdown}
            >
              Đội ngũ Bác sĩ
            </AppLink>
            <AppLink
              href="/cam-nang-thai-ky"
              className={`portal-nav-item ${isPregnancyGuidePage ? 'active' : ''}`}
              onClick={handleCloseDropdown}
            >
              Cẩm nang thai kỳ
            </AppLink>
            <AppLink
              href="/dich-vu"
              className={`portal-nav-item ${isServicesPage ? 'active' : ''}`}
              onClick={handleCloseDropdown}
            >
              Bảng giá dịch vụ
            </AppLink>
          </nav>
        </div>
      </div>
    </header>
  );
}
