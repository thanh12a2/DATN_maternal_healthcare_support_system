import { AppLink, navigate } from '../../../app/navigation';

export function PublicPortalFooter() {
  function handleNavigateHome(e: React.MouseEvent) {
    e.preventDefault();
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <footer className="public-portal-footer">
      <div className="portal-container portal-footer-main">
        <div className="portal-footer-grid">
          {/* Column 1: Hospital Brand Info */}
          <div className="portal-footer-col brand-col">
            <AppLink
              href="/"
              className="portal-footer-brand-wrap"
              style={{ textDecoration: 'none', cursor: 'pointer' }}
              onClick={handleNavigateHome}
            >
              <img
                src="/brand/logo-symbol-clean.png"
                alt="TÂM AN"
                className="portal-footer-symbol"
              />
              <div className="portal-footer-brand-text">
                <span className="portal-footer-brand-title">TÂM AN HOSPITAL</span>
                <span className="portal-footer-brand-slogan">Trọn vẹn yêu thương, vẹn toàn <strong style={{ color: '#ffd8a8' }}>yên tâm</strong></span>
              </div>
            </AppLink>
            <p className="portal-footer-desc">
              Hệ thống Bệnh viện Phụ sản &amp; Y học Bào thai Tâm An – <em>Trọn vẹn yêu thương, vẹn toàn yên tâm</em>. 
              Tiên phong ứng dụng mô hình chăm sóc thai sản toàn diện theo tiêu chuẩn y khoa tiên tiến, đồng hành cùng mẹ và bé trong từng khoảnh khắc thiêng liêng.
            </p>
            <div className="portal-footer-badges">
              <span className="footer-badge">Giấy phép hoạt động y tế giả định</span>
              <span className="footer-badge">Chăm sóc Sản khoa Toàn diện</span>
            </div>
          </div>

          {/* Column 2: Clinical Specialties & Packages */}
          <div className="portal-footer-col">
            <h4 className="portal-footer-heading">Dịch vụ &amp; Gói thai sản</h4>
            <ul className="portal-footer-list">
              <li><a href="#goi-thai-san">Gói sinh thường trọn gói Hạnh Phúc</a></li>
              <li><a href="#goi-thai-san">Gói sinh mổ chủ động Bình An</a></li>
              <li><AppLink href="/dich-vu">Siêu âm hình thái học thai nhi 5D</AppLink></li>
              <li><AppLink href="/dich-vu">Sàng lọc dị tật trước sinh (NIPT, Double Test)</AppLink></li>
              <li><AppLink href="/dich-vu">Khám &amp; Điều trị Phụ khoa kỹ thuật số</AppLink></li>
              <li><AppLink href="/dich-vu">Chăm sóc mẹ và bé sau sinh toàn diện</AppLink></li>
            </ul>
          </div>

          {/* Column 3: Patient Digital Services */}
          <div className="portal-footer-col">
            <h4 className="portal-footer-heading">Tiện ích Bệnh nhân</h4>
            <ul className="portal-footer-list">
              <li><AppLink href="/dang-nhap?returnUrl=/dat-lich">Đặt lịch khám trực tuyến</AppLink></li>
              <li><AppLink href="/hang-doi">Theo dõi số thứ tự phòng khám (Live)</AppLink></li>
              <li><AppLink href="/ho-so/hoan-thien">Cổng hồ sơ sức khỏe thai kỳ</AppLink></li>
              <li><AppLink href="/dich-vu">Bảng giá dịch vụ niêm yết</AppLink></li>
              <li><AppLink href="/bac-si">Danh bạ Chuyên gia &amp; Bác sĩ</AppLink></li>
              <li><AppLink href="/cam-nang-thai-ky">Cẩm nang kiến thức cho mẹ bầu</AppLink></li>
            </ul>
          </div>

          {/* Column 4: Emergency & Contacts */}
          <div className="portal-footer-col">
            <h4 className="portal-footer-heading">Hỗ trợ &amp; Khẩn cấp</h4>
            <div className="portal-footer-contact">
              <div className="contact-item highlight">
                <span>Cấp cứu Sản khoa (24/7):</span>
                <a href="tel:19006868" className="phone-number">1900 6868</a>
              </div>
              <div className="contact-item">
                <span>Tổng đài tư vấn &amp; Đặt hẹn:</span>
                <a href="tel:02439998888" className="phone-number secondary">(024) 3999 8888</a>
              </div>
              <div className="contact-item">
                <span>Địa chỉ cơ sở chính:</span>
                <p>Tòa nhà Bệnh viện Phụ sản Tâm An, 45 Phố Yersin, Hai Bà Trưng, Hà Nội</p>
              </div>
              <div className="contact-item">
                <span>Email hỗ trợ:</span>
                <p>chamsockhachhang@taman.local</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legal / Copyright Bar */}
      <div className="portal-footer-bottom">
        <div className="portal-container portal-footer-bottom-inner">
          <div className="portal-footer-copy-wrap">
            <p>© 2026 Bệnh viện Phụ sản Tâm An. Trọn vẹn yêu thương, vẹn toàn yên tâm.</p>
            <p className="portal-footer-disclaimer">
              Website minh họa phục vụ đồ án tốt nghiệp. Bệnh viện, bác sĩ và số liệu là giả định.
            </p>
          </div>
          <div className="portal-footer-bottom-links">
            <a href="#chinh-sach">Chính sách bảo mật y tế</a>
            <span className="dot">•</span>
            <a href="#quy-dinh">Quy định khám chữa bệnh</a>
            <span className="dot">•</span>
            <a href="#huong-dan">Hướng dẫn đón tiếp bệnh nhân</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
