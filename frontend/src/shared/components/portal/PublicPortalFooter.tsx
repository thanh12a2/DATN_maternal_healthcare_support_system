import { AppLink } from '../../../app/navigation';
import './patient-footer.css';

const services = [
  'Gói sinh thường trọn gói Hạnh Phúc',
  'Gói sinh mổ chủ động Bình An',
  'Siêu âm hình thái học thai nhi 5D',
  'Sàng lọc dị tật trước sinh (NIPT, Double Test)',
  'Khám & Điều trị Phụ khoa kỹ thuật số',
  'Chăm sóc mẹ và bé sau sinh toàn diện',
];
const links = [
  ['/dat-lich', 'Đặt lịch khám trực tuyến'],
  ['/lich-hen', 'Tra cứu lịch hẹn khám bệnh'],
  ['/ho-so/hoan-thien', 'Cổng hồ sơ sức khỏe thai kỳ'],
  ['/dich-vu', 'Bảng giá dịch vụ niêm yết'],
  ['/bac-si', 'Danh bạ Chuyên gia & Bác sĩ'],
  ['/cam-nang-thai-ky', 'Cẩm nang kiến thức cho mẹ bầu'],
];

export function PublicPortalFooter({ onHomeClick }: { onHomeClick?: () => void } = {}) {
  return (
    <footer className="ta-footer">
      <div className="ta-footer__inner">
        <div className="ta-footer__grid">
          <section className="ta-footer__brand">
            <AppLink className="landing-footer-brand" href="/" onClick={onHomeClick ? (event) => { event.preventDefault(); onHomeClick(); } : undefined}>
              <img src="/brand/logo-symbol-clean.png" alt="" />
              <span><b>TÂM AN HOSPITAL</b><small>Trọn vẹn yêu thương, vẹn toàn yên tâm</small></span>
            </AppLink>
            <p className="ta-footer__desc">Hệ thống Bệnh viện Phụ sản &amp; Y học Bào thai Tâm An – Trọn vẹn yêu thương, vẹn toàn yên tâm. Đồng hành cùng mẹ và bé trên hành trình chăm sóc sức khỏe.</p>
            <p className="landing-footer-badges">Giấy phép hoạt động y tế giả định · Chăm sóc Sản khoa Toàn diện</p>
          </section>
          <section>
            <h4>Dịch vụ &amp; Gói thai sản</h4>
            <div className="ta-footer__links">{services.map(item => <AppLink key={item} href="/dich-vu">{item}</AppLink>)}</div>
          </section>
          <section>
            <h4>Tiện ích Bệnh nhân</h4>
            <div className="ta-footer__links">{links.map(([href, label]) => <AppLink key={href} href={href}>{label}</AppLink>)}</div>
          </section>
          <section>
            <h4>Hỗ trợ &amp; Khẩn cấp</h4>
            <div className="ta-footer__contact">
              <p><small>Cấp cứu Sản khoa (24/7) — số giả định</small>1900 6868</p>
              <p><small>Tổng đài tư vấn &amp; Đặt hẹn — số giả định</small>(024) 3999 8888</p>
              <p><small>Địa chỉ cơ sở chính — giả định</small>Tòa nhà Bệnh viện Phụ sản Tâm An, 45 Phố Yersin, Hai Bà Trưng, Hà Nội</p>
              <p><small>Email hỗ trợ — giả định</small>chamsockhachhang@taman.local</p>
            </div>
          </section>
        </div>
        <div className="ta-footer__bottom">
          <p>© 2026 Bệnh viện Phụ sản Tâm An. Trọn vẹn yêu thương, vẹn toàn yên tâm.<br />Website minh họa phục vụ đồ án tốt nghiệp. Bệnh viện, bác sĩ và số liệu là giả định.</p>
          <div className="ta-footer__legal">{['Chính sách bảo mật y tế', 'Quy định khám chữa bệnh', 'Hướng dẫn đón tiếp bệnh nhân'].map(item => <span key={item} title="Nội dung đang được cập nhật">{item}</span>)}</div>
        </div>
      </div>
    </footer>
  );
}
