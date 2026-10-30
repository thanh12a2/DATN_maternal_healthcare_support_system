import React from 'react';
import '../../../styles/why-choose-us.css';

// SVG Icons theo phong cách Vinmec chuẩn mực
function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 3v5a3.5 3.5 0 0 0 7 0V3" />
      <path d="M8 11.5v3.5a4 4 0 0 0 8 0V11" />
      <circle cx="16" cy="10" r="2" />
      <circle cx="4.5" cy="3" r="1" />
      <circle cx="11.5" cy="3" r="1" />
    </svg>
  );
}

function ShieldCrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}

function MedicalTechIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <circle cx="12" cy="11" r="1.5" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="18" cy="6" r="1" />
      <line x1="6" y1="7" x2="10.5" y2="10" />
      <line x1="18" y1="7" x2="13.5" y2="10" />
      <line x1="12" y1="12.5" x2="12" y2="16.5" />
    </svg>
  );
}

function StethoscopeAltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v6a3 3 0 0 0 6 0V3" />
      <path d="M8 12v3a5 5 0 0 0 10 0v-2" />
      <circle cx="18" cy="13" r="2" />
      <circle cx="5" cy="3" r="1" />
      <circle cx="11" cy="3" r="1" />
    </svg>
  );
}

export const WhyChooseUsSection: React.FC = () => {
  return (
    <section className="why-choose-us-section" id="tai-sao-chon-tam-an" aria-labelledby="why-choose-title">
      <div id="chuyen-khoa" style={{ position: 'relative', top: '-80px' }} />
      <div className="portal-container why-choose-us-inner">
        {/* Tiêu đề mục & Đường gạch trang trí */}
        <div className="why-choose-header">
          <h2 id="why-choose-title" className="why-choose-title">
            Tại sao nên chọn Tâm An?
          </h2>
          <div className="why-choose-accent-line" aria-hidden="true" />
        </div>

        {/* Lưới nội dung 2 cột: Ảnh bác sĩ bên trái - 4 trụ cột bên phải */}
        <div className="why-choose-content-grid">
          {/* Cột trái: Hình ảnh bác sĩ chuyên khoa */}
          <div className="why-choose-media-col">
            <img
              src="/images/why-choose-us-doctor.png"
              alt="Bác sĩ chuyên khoa Bệnh viện Phụ sản Tâm An"
              className="why-choose-doctor-img"
              loading="lazy"
            />
          </div>

          {/* Cột phải: Lưới 4 trụ cột chất lượng (2x2) */}
          <div className="why-choose-pillars-grid">
            {/* Trụ cột 1 */}
            <div className="why-choose-pillar-item">
              <div className="why-pillar-icon" aria-hidden="true">
                <StethoscopeIcon />
              </div>
              <h3 className="why-pillar-title">Chuyên gia giàu kinh nghiệm</h3>
              <p className="why-pillar-desc">
                Quy tụ các bác sĩ chuyên khoa II và tiến sĩ đầu ngành về Sản phụ khoa. Đội ngũ y bác sĩ đồng hành tận tâm, thăm khám 1:1 và theo dõi sát sao từng cột mốc phát triển của thai nhi.
              </p>
            </div>

            {/* Trụ cột 2 */}
            <div className="why-choose-pillar-item">
              <div className="why-pillar-icon" aria-hidden="true">
                <ShieldCrossIcon />
              </div>
              <h3 className="why-pillar-title">Chất lượng quốc tế</h3>
              <p className="why-pillar-desc">
                Quy trình kiểm soát vô khuẩn một chiều nghiêm ngặt cùng hệ thống phòng sinh khép kín. Áp dụng tiêu chuẩn an toàn sản khoa hiện đại, mang lại sự an tâm tuyệt đối cho mẹ và bé.
              </p>
            </div>

            {/* Trụ cột 3 */}
            <div className="why-choose-pillar-item">
              <div className="why-pillar-icon" aria-hidden="true">
                <MedicalTechIcon />
              </div>
              <h3 className="why-pillar-title">Công nghệ tiên tiến</h3>
              <p className="why-pillar-desc">
                Trang bị hệ thống máy siêu âm 5D hình thái học chuyên sâu và xét nghiệm sàng lọc trước sinh chính xác. Hỗ trợ chẩn đoán sớm và xây dựng phác đồ theo dõi thai kỳ cá thể hóa.
              </p>
            </div>

            {/* Trụ cột 4 */}
            <div className="why-choose-pillar-item">
              <div className="why-pillar-icon" aria-hidden="true">
                <StethoscopeAltIcon />
              </div>
              <h3 className="why-pillar-title">Nghiên cứu &amp; Đổi mới</h3>
              <p className="why-pillar-desc">
                Liên tục ứng dụng kỹ thuật giảm đau sản khoa đa tầng, hỗ trợ nuôi con bằng sữa mẹ và theo dõi sức khỏe liên tục, giúp trải nghiệm vượt cạn nhẹ nhàng và trọn vẹn yêu thương.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
