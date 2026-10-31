import { AppLink } from '../../../app/navigation';

export function BackgroundShapes() {
  return (
    <>
      <AppLink
        className="brand-logo"
        href="/"
        aria-label="Bệnh viện Phụ sản Tâm An — Về trang chủ"
      >
        <img
          src="/brand/logo-symbol-clean.png"
          alt="Bệnh viện Phụ sản Tâm An"
          className="brand-logo-img"
        />
        <div className="brand-text-group">
          <div className="brand-name-row">
            <span className="brand-main-name">TÂM AN</span>
            <span className="brand-badge">HOSPITAL</span>
          </div>
          <span className="brand-slogan-text">
            Trọn vẹn yêu thương, vẹn toàn <strong className="slogan-accent">yên tâm</strong>
          </span>
        </div>
      </AppLink>

      <section className="brand-panel" aria-hidden="true">
        <div className="visual-stage" aria-hidden="true">
          <span className="orb-ring" />
          <span className="semi-shape" />
          <span className="red-dot" />
          <span className="green-pill" />
          <span className="dot-grid" />
          <span className="medical-cross" />
          <span className="palette-shape shape-blue-disc" />
          <span className="palette-shape shape-green-ring" />
          <span className="palette-shape shape-red-square" />
          <span className="palette-shape shape-navy-pill" />
          <span className="palette-shape shape-green-capsule" />
          <span className="palette-shape shape-red-semi" />
          <span className="palette-shape shape-blue-ring-small" />
        </div>
      </section>
    </>
  );
}
