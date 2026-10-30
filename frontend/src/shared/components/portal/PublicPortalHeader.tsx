import { useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../../app/navigation';
import { UserChip } from '../navigation/UserChip';

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

export function PublicPortalHeader() {
  const auth = useAuthSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = auth.status === 'authenticated' && Boolean(auth.user);

  function handleNavigateHome(e: React.MouseEvent) {
    e.preventDefault();
    setMobileMenuOpen(false);
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <header className="public-portal-header">
      {/* 1. Tầng trên: Logo bên trái - Nút Đăng nhập/Đăng ký hoặc Chip người dùng bên phải */}
      <div className="portal-header-top">
        <div className="portal-container portal-header-top-inner">
          {/* Logo & Slogan Tâm An - Điều hướng chuẩn về http://localhost:3000/ */}
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

      {/* 2. Tầng dưới: Thanh điều hướng gọn gàng, thoáng mắt */}
      <div className={`portal-header-nav ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="portal-container">
          <nav className="portal-nav-bar" aria-label="Thanh điều hướng chính">
            <AppLink
              href="/"
              className="portal-nav-item active"
              onClick={handleNavigateHome}
            >
              Trang chủ
            </AppLink>
            <a
              href="#chuyen-khoa"
              className="portal-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              Chuyên khoa
            </a>
            <a
              href="#goi-thai-san"
              className="portal-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              Gói thai sản
            </a>
            <a
              href="#doi-ngu-bac-si"
              className="portal-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              Đội ngũ Bác sĩ
            </a>
            <a
              href="#tien-ich-hang-doi"
              className="portal-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              Hàng đợi Live
            </a>
            <a
              href="#cam-nang-thai-ky"
              className="portal-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              Cẩm nang thai kỳ
            </a>
            <AppLink
              href="/dich-vu"
              className="portal-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              Bảng giá dịch vụ
            </AppLink>
          </nav>
        </div>
      </div>
    </header>
  );
}
