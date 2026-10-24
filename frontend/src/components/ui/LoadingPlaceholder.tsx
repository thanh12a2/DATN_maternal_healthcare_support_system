import { useEffect, useState } from 'react';
import '../../styles/loading-placeholder.css';

interface LoadingPlaceholderProps {
  visible: boolean;
  label?: string;
}

const FADE_DURATION_MS = 380;

export function LoadingPlaceholder({ visible, label = 'Đang tải nội dung' }: LoadingPlaceholderProps) {
  const [mounted, setMounted] = useState(visible);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    let timer = 0;

    if (visible) {
      setMounted(true);
      frame = window.requestAnimationFrame(() => setShown(true));
    } else {
      setShown(false);
      timer = window.setTimeout(() => setMounted(false), FADE_DURATION_MS);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      className={`loading-placeholder ${shown ? 'is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={visible}
      aria-label={label}
    >
      <div className="loading-skeleton-shell" aria-hidden="true">
        <aside className="loading-skeleton-sidebar">
          <span className="loading-skeleton-block menu" />
          <span className="loading-skeleton-block brand" />
          <div className="loading-skeleton-nav">
            {Array.from({ length: 6 }, (_, index) => (
              <span className="loading-skeleton-block nav" key={index} />
            ))}
          </div>
          <span className="loading-skeleton-block logout" />
        </aside>
        <main className="loading-skeleton-main">
          <header className="loading-skeleton-topbar">
            <span className="loading-skeleton-block topbar-title" />
            <span className="loading-skeleton-block account" />
          </header>
          <section className="loading-skeleton-content">
            <div className="loading-skeleton-heading">
              <span className="loading-skeleton-block eyebrow" />
              <span className="loading-skeleton-block title" />
              <span className="loading-skeleton-block description" />
            </div>
            <div className="loading-skeleton-grid">
              <div className="loading-skeleton-card wide">
                <span className="loading-skeleton-block card-title" />
                <span className="loading-skeleton-block line long" />
                <span className="loading-skeleton-block line medium" />
                <div className="loading-skeleton-fields">
                  <span className="loading-skeleton-block field" />
                  <span className="loading-skeleton-block field" />
                  <span className="loading-skeleton-block field" />
                  <span className="loading-skeleton-block field" />
                </div>
              </div>
              <div className="loading-skeleton-card side">
                <span className="loading-skeleton-block card-title" />
                <span className="loading-skeleton-block line long" />
                <span className="loading-skeleton-block line medium" />
                <span className="loading-skeleton-block action" />
              </div>
            </div>
          </section>
        </main>
      </div>
      <span className="loading-skeleton-label">{label}</span>
    </div>
  );
}
