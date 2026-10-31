import React from 'react';
import { AppLink } from '../../../app/navigation';
import { HeroMotherArt } from './HeroMotherArt';
import '../../../styles/personalized-hero.css';

// SVG Icons cho 3 trụ cột y khoa chuyên sâu
function DoctorSpecialistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function UltrasoundNiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 18h8" />
      <path d="M3 22h18" />
      <path d="M14 22a7 7 0 1 0 0-14h-1" />
      <path d="M9 14h2" />
      <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
      <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
    </svg>
  );
}

function FamilyMaternityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

/**
 * Khối Hero trang chủ dành cho khách vãng lai (chưa đăng nhập).
 * Giữ nguyên bố cục & cấu trúc chuẩn mực:
 * - Tone sáng, thoáng đãng (#F8FAFC)
 * - Hero 2 cột (tiêu đề bên trái, mái vòm nghệ thuật bên phải)
 * - 3 thẻ điểm mạnh y khoa & thẻ đặt khám trực tuyến
 */
export const PublicHero: React.FC = () => {
  return (
    <section className="personalized-hero-section" aria-label="Giới thiệu Cổng Y tế Bệnh viện Phụ sản Tâm An">
      <div className="portal-container personalized-hero-inner">
        {/* CỘT TRÁI: Định vị thương hiệu & Đặt khám */}
        <div className="ph-content-col">
          {/* 1. Phần giới thiệu tiêu đề */}
          <div className="ph-hero-intro">
            <h1 className="ph-hero-title">
              Trọn vẹn yêu thương,<br />
              <span className="ph-title-accent">vẹn toàn yên tâm</span> đón con yêu
            </h1>
            <p className="ph-hero-sub">
              Đồng hành toàn diện cùng mẹ và bé từ những tuần thai đầu tiên, theo dõi sát sao từng cột mốc phát triển cho đến khoảnh khắc thiêng liêng chào đón con yêu bình an.
            </p>
          </div>

          {/* 2. 3 Thẻ điểm mạnh */}
          <div className="ph-public-pillars">
            <div className="ph-public-pillar">
              <div className="ph-pillar-head">
                <div className="ph-pillar-icon blue">
                  <DoctorSpecialistIcon />
                </div>
                <strong>Bác sĩ chuyên khoa II</strong>
              </div>
              <span>
                Hội chẩn 1:1, giàu kinh nghiệm<br />
                quản lý thai kỳ trọn gói
              </span>
            </div>

            <div className="ph-public-pillar">
              <div className="ph-pillar-head">
                <div className="ph-pillar-icon green">
                  <UltrasoundNiptIcon />
                </div>
                <strong>Siêu âm 5D &amp; NIPT sớm</strong>
              </div>
              <span>
                Hệ thống siêu âm 5D hiện đại,<br />
                tầm soát dị tật chuẩn xác
              </span>
            </div>

            <div className="ph-public-pillar">
              <div className="ph-pillar-head">
                <div className="ph-pillar-icon amber">
                  <FamilyMaternityIcon />
                </div>
                <strong>Phòng sinh gia đình</strong>
              </div>
              <span>
                Đỡ đẻ không đau, phòng lưu viện<br />
                tiện nghi, hỗ trợ tận tâm
              </span>
            </div>
          </div>

          {/* 4. Thẻ Dịch vụ & Đặt hẹn */}
          <article className="ph-appt-card ph-public-booking-card" aria-label="Đặt hẹn khám thai">
            <div className="ph-appt-date ph-public-date">
              <strong>24/7</strong>
              <span>Đặt khám</span>
            </div>
            <div className="ph-appt-info">
              <span className="ph-chip">✦ Đặt khám trực tuyến</span>
              <h2>Khám thai định kỳ &amp; Siêu âm 5D hình thái</h2>
              <p>Chủ động chọn bác sĩ chuyên khoa, khung giờ khám và không cần xếp hàng</p>
              <p className="ph-hotline-row">
                Cấp cứu &amp; tư vấn sản khoa (24/7):{' '}
                <a href="tel:19006868" className="ph-hotline-link">
                  1900 6868
                </a>
              </p>
            </div>
            <div className="ph-btns">
              <AppLink href="/dang-nhap?returnUrl=/dat-lich" className="ph-btn ph-btn-book">
                Đặt lịch ngay
              </AppLink>
              <a href="#goi-thai-san" className="ph-btn ph-btn-outline">
                Xem gói sinh
              </a>
            </div>
          </article>
        </div>

        {/* CỘT PHẢI: Mái vòm nghệ thuật mẹ bầu và trẻ thơ */}
        <HeroMotherArt />
      </div>
    </section>
  );
};
