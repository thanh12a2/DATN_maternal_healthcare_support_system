import { useEffect } from "react";
import { useAuthSession } from "../app/AuthSessionProvider";
import { AppLink, navigate } from "../app/navigation";
import "../styles/not-found.css";

export function NotFoundPage() {
  const auth = useAuthSession();
  const homePath =
    auth.status === "authenticated" ? "/tong-quan" : "/dang-nhap";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Không tìm thấy trang — An Tâm Medical";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate(homePath, { replace: true });
  }

  return (
    <main className="not-found-page">
      <section
        className="not-found-section"
        aria-labelledby="not-found-heading"
      >
        <AppLink
          className="not-found-brand"
          href={homePath}
          aria-label="An Tâm Medical — về trang chính"
        >
          <span className="not-found-brand-mark" aria-hidden="true" />
          <span className="not-found-brand-copy">
            <strong>An Tâm Medical</strong>
            <span>Patient portal</span>
          </span>
        </AppLink>

        <div className="not-found-visual-stage" aria-hidden="true">
          <span className="not-found-orb-ring" />
          <span className="not-found-semi-shape" />
          <span className="not-found-red-dot" />
          <span className="not-found-green-pill" />
          <span className="not-found-dot-grid" />
          <span className="not-found-medical-cross" />
          <span className="not-found-shape not-found-shape-blue-disc" />
          <span className="not-found-shape not-found-shape-green-ring" />
          <span className="not-found-shape not-found-shape-red-square" />
          <span className="not-found-shape not-found-shape-navy-pill" />
          <span className="not-found-shape not-found-shape-green-capsule" />
          <span className="not-found-shape not-found-shape-red-semi" />
          <span className="not-found-shape not-found-shape-blue-ring-small" />
        </div>

        <div className="not-found-card">
          <div className="not-found-code" aria-hidden="true">
            404
          </div>
          <p className="not-found-eyebrow">Không tìm thấy đường dẫn</p>
          <h1 id="not-found-heading">Trang này không tồn tại</h1>
          <p className="not-found-lead">
            Đường dẫn có thể đã thay đổi hoặc không còn khả dụng. Hồ sơ và dữ
            liệu sức khỏe của bạn không bị ảnh hưởng.
          </p>
          <div className="not-found-actions">
            <button className="not-found-button" type="button" onClick={goBack}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
                <path d="M9 12h10" />
              </svg>
              Quay lại trang trước
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
