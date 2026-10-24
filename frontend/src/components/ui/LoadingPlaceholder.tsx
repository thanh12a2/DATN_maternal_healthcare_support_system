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
    <div className={`loading-placeholder ${shown ? 'is-visible' : ''}`} role="status" aria-live="polite" aria-busy={visible} aria-label={label}>
      <div className="loading-spinner" aria-hidden="true"><span /></div>
      <span className="loading-skeleton-label">{label}</span>
    </div>
  );
}
